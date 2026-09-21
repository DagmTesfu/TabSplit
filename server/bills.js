// Pure finalization domain logic: validation, deterministic recalculation and
// share-code generation. No database, network or filesystem access here, so it
// is fully unit-testable; the route layer wires it to Supabase later.

import { randomBytes } from 'node:crypto';
import { computePersonTotals } from './split.js';
import { assertSupportedCurrency } from './ai.js';

// Machine-readable error for API mapping (status codes live in the route).
export class BillError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BillError';
    this.code = code;
  }
}

// Client-supplied ids are stored verbatim but strictly format-checked: 1-64
// visible ASCII characters, no whitespace or control characters.
const ID_PATTERN = /^[!-~]{1,64}$/;
const MAX_PEOPLE = 50;
const MAX_ITEMS = 100;
const MAX_NAME_LENGTH = 120;
const MAX_PERSON_NAME_LENGTH = 60;

// Visible ASCII except space and DEL; anything else in names is rejected.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function assertText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new BillError('INVALID_BILL', `${label} is required`);
  if (text.length > maxLength) throw new BillError('INVALID_BILL', `${label} is too long`);
  if (CONTROL_CHARS.test(text)) throw new BillError('INVALID_BILL', `${label} contains invalid characters`);
  return text;
}

function assertId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new BillError('INVALID_BILL', `${label} must be 1-64 visible ASCII characters`);
  }
  return value;
}

function assertMinorAmount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BillError('INVALID_BILL', `${label} must be a non-negative integer in minor units`);
  }
  if (value > Number.MAX_SAFE_INTEGER - 1_000_000_000) {
    throw new BillError('INVALID_BILL', `${label} is too large`);
  }
  return value;
}

function assertSignedMinorAmount(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw new BillError('INVALID_BILL', `${label} must be a safe integer in minor units`);
  }
  if (Math.abs(value) > Number.MAX_SAFE_INTEGER - 1_000_000_000) {
    throw new BillError('INVALID_BILL', `${label} is too large`);
  }
  return value;
}

// Derive taxInclusive deterministically from the bill amounts and printed total.
export function deriveTaxInclusive({ items, taxMinor = 0, tipMinor = 0, additionalCharges = [], printedTotalMinor = null }) {
  const itemsSubtotalMinor = items.reduce((sum, item) => sum + item.priceMinor, 0);
  const chargesTotalMinor = additionalCharges.reduce((sum, charge) => sum + charge.amountMinor, 0);
  const candidateExclusive = itemsSubtotalMinor + taxMinor + tipMinor + chargesTotalMinor;
  const candidateInclusive = itemsSubtotalMinor + tipMinor + chargesTotalMinor;

  if (taxMinor === 0) {
    return false;
  }
  if (printedTotalMinor !== null && printedTotalMinor !== undefined) {
    if (candidateExclusive === printedTotalMinor) return false;
    if (candidateInclusive === printedTotalMinor) return true;
    throw new BillError('INVALID_BILL', 'Receipt amounts do not reconcile with printed total.');
  }
  return false;
}

// Structural and semantic validation of the client-submitted bill.
// Returns a normalized copy; never mutates or trusts the input object.
export function validateBillRequest(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new BillError('INVALID_BILL', 'Bill must be a JSON object');
  }
  const { code } = assertSupportedCurrency(input.currency);
  const restaurantName = input.restaurantName === undefined || input.restaurantName === null
    ? ''
    : assertText(input.restaurantName, 'Restaurant name', MAX_NAME_LENGTH);

  if (!Array.isArray(input.people) || input.people.length === 0) {
    throw new BillError('INVALID_BILL', 'At least one person is required');
  }
  if (input.people.length > MAX_PEOPLE) {
    throw new BillError('INVALID_BILL', `At most ${MAX_PEOPLE} people are allowed`);
  }
  const peopleById = new Map();
  for (const person of input.people) {
    if (person === null || typeof person !== 'object' || Array.isArray(person)) {
      throw new BillError('INVALID_BILL', 'Every person must be an object');
    }
    const id = assertId(person.id, 'Person id');
    if (peopleById.has(id)) throw new BillError('INVALID_BILL', `Duplicate person id: ${id}`);
    const name = assertText(person.name, 'Person name', MAX_PERSON_NAME_LENGTH);
    peopleById.set(id, { id, name });
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new BillError('INVALID_BILL', 'At least one item is required');
  }
  if (input.items.length > MAX_ITEMS) {
    throw new BillError('INVALID_BILL', `At most ${MAX_ITEMS} items are allowed`);
  }
  const itemIds = new Set();
  const items = input.items.map((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new BillError('INVALID_BILL', `Item ${index + 1} must be an object`);
    }
    const id = assertId(item.id, `Item ${index + 1} id`);
    if (itemIds.has(id)) throw new BillError('INVALID_BILL', `Duplicate item id: ${id}`);
    itemIds.add(id);
    const name = assertText(item.name, `Item ${index + 1} name`, MAX_NAME_LENGTH);
    const priceMinor = assertSignedMinorAmount(item.priceMinor, `Item "${name}" price`);
    let quantity = 1;
    if (item.quantity !== undefined && item.quantity !== null) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) {
        throw new BillError('INVALID_BILL', `Item "${name}" quantity must be a positive integer`);
      }
      quantity = item.quantity;
    }
    const assignedTo = item.assignedTo ?? [];
    if (!Array.isArray(assignedTo)) {
      throw new BillError('INVALID_BILL', `Item "${name}" assignedTo must be an array of person ids`);
    }
    const assignees = [];
    for (const personId of assignedTo) {
      if (!peopleById.has(personId)) {
        throw new BillError('INVALID_BILL', `Item "${name}" references unknown person: ${String(personId)}`);
      }
      if (assignees.includes(personId)) {
        throw new BillError('INVALID_BILL', `Item "${name}" lists a person more than once`);
      }
      assignees.push(personId);
    }
    return { id, name, quantity, priceMinor, assignedTo: assignees };
  });

  const rawCharges = input.additionalCharges;
  let additionalCharges = [];
  if (rawCharges !== undefined && rawCharges !== null) {
    if (!Array.isArray(rawCharges)) {
      throw new BillError('INVALID_BILL', 'additionalCharges must be an array');
    }
    if (rawCharges.length > 50) {
      throw new BillError('INVALID_BILL', 'At most 50 additional charges are allowed');
    }
    let chargesTotalMinor = 0;
    additionalCharges = rawCharges.map((charge, index) => {
      if (charge === null || typeof charge !== 'object' || Array.isArray(charge)) {
        throw new BillError('INVALID_BILL', `Charge at index ${index} must be an object`);
      }
      const name = assertText(charge.name, `Charge at index ${index} name`, MAX_NAME_LENGTH);
      const amountMinor = assertMinorAmount(charge.amountMinor, `Charge "${name}" amount`);
      chargesTotalMinor += amountMinor;
      if (!Number.isSafeInteger(chargesTotalMinor)) {
        throw new BillError('INVALID_BILL', 'Additional charges total is too large');
      }
      return { name, amountMinor };
    });
  }

  const printedTotalMinor = input.printedTotalMinor !== undefined && input.printedTotalMinor !== null
    ? assertMinorAmount(input.printedTotalMinor, 'Printed total')
    : null;

  return {
    restaurantName,
    currency: code,
    items,
    people: [...peopleById.values()],
    taxMinor: input.taxMinor === undefined || input.taxMinor === null ? 0 : assertMinorAmount(input.taxMinor, 'Tax'),
    tipMinor: input.tipMinor === undefined || input.tipMinor === null ? 0 : assertMinorAmount(input.tipMinor, 'Tip'),
    additionalCharges,
    printedTotalMinor,
  };
}

// Deterministic recalculation via the canonical split module. The client never
// sends totals; everything numeric here is derived server-side.
function recalculate(validated) {
  try {
    const taxInclusive = deriveTaxInclusive(validated);
    return computePersonTotals({
      items: validated.items.map(({ id, name, quantity, priceMinor, assignedTo }) => ({
        id, name, quantity, priceMinor, assignedTo,
      })),
      people: validated.people,
      taxMinor: validated.taxMinor,
      tipMinor: validated.tipMinor,
      taxInclusive,
      additionalCharges: validated.additionalCharges,
    });
  } catch (error) {
    // split.js invariants are defense in depth; validation above should make
    // these unreachable, and they must never surface as 500s.
    throw new BillError('INVALID_BILL', error.message);
  }
}

// Full finalize pipeline: validate -> recalculate -> enforce assignment.
// Returns the canonical bill payload that the database layer will persist.
export function finalizeBill(input) {
  const validated = validateBillRequest(input);
  const result = recalculate(validated);
  if (!result.fullyAssigned) {
    throw new BillError('UNASSIGNED_ITEMS', 'Every item must be assigned to at least one person before finalizing.');
  }
  return {
    restaurantName: validated.restaurantName,
    currency: validated.currency,
    items: validated.items,
    people: validated.people,
    taxMinor: result.taxMinor,
    taxInclusive: result.taxInclusive,
    tipMinor: result.tipMinor,
    additionalCharges: validated.additionalCharges,
    printedTotalMinor: validated.printedTotalMinor,
    totals: {
      people: result.people.map(({ id, name, totalMinor }) => ({ id, name, totalMinor })),
      itemsTotalMinor: result.itemsTotalMinor,
      chargesTotalMinor: result.chargesTotalMinor,
      billTotalMinor: result.billTotalMinor,
      assignedMinor: result.assignedMinor,
      unassignedMinor: result.unassignedMinor,
      fullyAssigned: result.fullyAssigned,
    },
  };
}

// 8-character base58 share code (no 0/O/I/l confusables), rejection-sampled
// from crypto random bytes for an unbiased distribution. Uniqueness is enforced
// by the database; callers retry on the rare unique violation.
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const SHARE_CODE_LENGTH = 8;

export function generateShareCode() {
  let code = '';
  while (code.length < SHARE_CODE_LENGTH) {
    const bytes = randomBytes(SHARE_CODE_LENGTH);
    for (const byte of bytes) {
      if (code.length === SHARE_CODE_LENGTH) break;
      // Reject values that would bias the alphabet modulo.
      if (byte >= 232) continue; // 232 = 4 * 58, largest multiple of 58 <= 255
      code += BASE58[byte % 58];
    }
  }
  return code;
}

// Strict format check for incoming share codes before any database lookup.
export function isValidShareCode(code) {
  return typeof code === 'string'
    && code.length === SHARE_CODE_LENGTH
    && [...code].every((char) => BASE58.includes(char));
}
