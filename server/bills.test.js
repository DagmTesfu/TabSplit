// Hermetic tests for pure finalization logic: validation, recalculation and
// share codes. No database, no network, no filesystem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBillRequest, finalizeBill, generateShareCode, isValidShareCode,
  SHARE_CODE_LENGTH, BillError,
} from './bills.js';

const validInput = {
  restaurantName: ' Kaldi ',
  currency: 'usd',
  items: [{ id: 'i1', name: 'Pizza', priceMinor: 60000, assignedTo: ['p1'] }],
  people: [{ id: 'p1', name: 'Dagm' }],
  taxMinor: 1000,
  tipMinor: 500,
};

function billError(fn, code = 'INVALID_BILL') {
  return assert.throws(() => fn(), (error) => error instanceof BillError && error.code === code);
}

test('validation: normalizes a valid bill without mutating the input', () => {
  const input = JSON.parse(JSON.stringify(validInput));
  const result = validateBillRequest(input);
  assert.deepEqual(result, {
    restaurantName: 'Kaldi',
    currency: 'USD',
    items: [{ id: 'i1', name: 'Pizza', quantity: 1, priceMinor: 60000, assignedTo: ['p1'] }],
    people: [{ id: 'p1', name: 'Dagm' }],
    taxMinor: 1000,
    tipMinor: 500,
    additionalCharges: [],
    printedTotalMinor: null,
  });
  assert.equal(input.items[0].name, 'Pizza'); // input untouched
});

test('validation: defaults, trimming and currency normalization', () => {
  const result = validateBillRequest({
    currency: 'ETB',
    items: [{ id: 'i1', name: ' Item ', priceMinor: 5, assignedTo: ['p1'] }],
    people: [{ id: 'p1', name: ' A ' }],
  });
  assert.equal(result.restaurantName, '');
  assert.equal(result.currency, 'ETB');
  assert.equal(result.taxMinor, 0);
  assert.equal(result.tipMinor, 0);
  assert.deepEqual(result.additionalCharges, []);
  assert.equal(result.printedTotalMinor, null);
  assert.equal(result.items[0].name, 'Item');
  assert.equal(result.items[0].quantity, 1);
  assert.equal(result.people[0].name, 'A');
  assert.deepEqual(result.items[0].assignedTo, ['p1']); // assignedTo defaulted when absent
});

test('validation: rejects structurally invalid bills', () => {
  const base = structuredClone(validInput);
  const cases = [
    null, [], 'bill', 42,
    { ...base, restaurantName: 'x'.repeat(121) },
    { ...base, restaurantName: 'bad\u0000name' },
    { ...base, people: [] },
    { ...base, people: 'nope' },
    { ...base, people: [null] },
    { ...base, people: [{ id: 'p1' }] },
    { ...base, people: [{ id: 'p1', name: '' }] },
    { ...base, people: [{ id: 'p1', name: 42 }] },
    { ...base, people: [{ id: 'p1', name: 'x'.repeat(61) }] },
    { ...base, people: [{ id: 'p 1', name: 'Dagm' }] },
    { ...base, people: [{ id: '', name: 'Dagm' }] },
    { ...base, people: [{ id: 'x'.repeat(65), name: 'Dagm' }] },
    { ...base, people: [{ id: 'p1', name: 'A' }, { id: 'p1', name: 'B' }] },
    { ...base, items: [] },
    { ...base, items: 'nope' },
    { ...base, items: [null] },
    { ...base, items: [{ name: 'Pizza', priceMinor: 1, assignedTo: [] }] },
    { ...base, items: [{ id: 'i1', priceMinor: 1, assignedTo: [] }] },
    { ...base, items: [{ id: 'i1', name: '', priceMinor: 1, assignedTo: [] }] },
    { ...base, items: [{ id: 'i1', name: 'Pizza', assignedTo: [] }] },
    { ...base, items: [{ id: 'i1', name: 'Pizza', quantity: 0, priceMinor: 10, assignedTo: [] }] },
    { ...base, items: [{ id: 'i1', name: 'Pizza', priceMinor: 1.5, assignedTo: [] }] },
    { ...base, items: [{ id: 'i1', name: 'Pizza', priceMinor: '600', assignedTo: [] }] },
    { ...base, items: [{ id: 'i1', name: 'Pizza', priceMinor: Number.MAX_SAFE_INTEGER, assignedTo: [] }] },
    { ...base, items: [{ id: 'i1', name: 'Pizza', priceMinor: 1, assignedTo: 'p1' }] },
    { ...base, items: [{ id: 'i1', name: 'Pizza', priceMinor: 1, assignedTo: ['ghost'] }] },
    { ...base, items: [{ id: 'i1', name: 'Pizza', priceMinor: 1, assignedTo: ['p1', 'p1'] }] },
    { ...base, taxMinor: -1 },
    { ...base, taxMinor: 1.5 },
    { ...base, taxMinor: '100' },
    { ...base, tipMinor: -1 },
    { ...base, tipMinor: 2 ** 53 },
    { ...base, printedTotalMinor: -1 },
    { ...base, items: Array(101).fill(base.items[0]) },
    { ...base, people: Array(51).fill(base.people[0]).map((p, i) => ({ ...p, id: `p${i}` })) },
  ];
  for (const [index, data] of cases.entries()) {
    // Currency errors come from the shared extraction validator as AiError;
    // every other structural violation is a BillError.
    assert.throws(
      () => validateBillRequest(data),
      (error) => error instanceof BillError || error.code === 'INVALID_CURRENCY',
      `case ${index} should throw`
    );
  }
  // Currency-specific rejections keep the extraction error contract.
  for (const data of [{ ...base, currency: 'GBP' }, { ...base, currency: '' }]) {
    assert.throws(() => validateBillRequest(data), (error) => error.code === 'INVALID_CURRENCY');
  }
});

test('validation: allows duplicate display names with distinct ids', () => {
  const result = validateBillRequest({
    currency: 'ETB',
    items: [{ id: 'i1', name: 'X', priceMinor: 10, assignedTo: ['a', 'b'] }],
    people: [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Alex' }],
  });
  assert.equal(result.people.length, 2);
});

test('finalization: single-person item pays full amount plus tax/tip pro-rata', () => {
  const bill = finalizeBill({
    restaurantName: 'Kaldi',
    currency: 'USD',
    items: [{ id: 'i1', name: 'Pizza', priceMinor: 10000, assignedTo: ['p1'] }],
    people: [{ id: 'p1', name: 'Dagm' }, { id: 'p2', name: 'Abel' }],
    taxMinor: 1500,
    tipMinor: 500,
  });
  assert.deepEqual(bill.totals.people, [
    { id: 'p1', name: 'Dagm', totalMinor: 12000 },
    { id: 'p2', name: 'Abel', totalMinor: 0 },
  ]);
  assert.equal(bill.totals.billTotalMinor, 12000);
  assert.equal(bill.totals.fullyAssigned, true);
  assert.equal(bill.currency, 'USD');
});

test('finalization: shared items split exactly, remainders deterministic', () => {
  const bill = finalizeBill({
    currency: 'ETB',
    items: [{ id: 'i1', name: 'Fries', priceMinor: 20000, assignedTo: ['a', 'b', 'c'] }],
    people: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
  });
  assert.deepEqual(bill.totals.people.map((person) => person.totalMinor), [6667, 6667, 6666]);
  assert.equal(bill.totals.assignedMinor, 20000);
});

test('finalization: client-provided totals are ignored, server math wins', () => {
  const bill = finalizeBill({
    ...validInput,
    restaurantName: 'R',
    currency: 'USD',
    taxMinor: 0,
    tipMinor: 0,
    items: [{ id: 'i1', name: 'Pizza', priceMinor: 100, assignedTo: ['p1'] }],
    people: [{ id: 'p1', name: 'Dagm' }],
    totalMinor: 999999, // bogus client total must have zero effect
    billTotal: '1 million', // ignored structurally, never validated as a total
  });
  assert.equal(bill.totals.billTotalMinor, 100);
});

test('finalization: unassigned items block with UNASSIGNED_ITEMS', () => {
  billError(
    () => finalizeBill({
      currency: 'USD',
      items: [
        { id: 'i1', name: 'Pizza', priceMinor: 100, assignedTo: ['p1'] },
        { id: 'i2', name: 'Mystery', priceMinor: 50, assignedTo: [] },
      ],
      people: [{ id: 'p1', name: 'Dagm' }],
    }),
    'UNASSIGNED_ITEMS'
  );
});

test('finalization: everything assigned reconciles exactly to the bill total', () => {
  const bill = finalizeBill({
    currency: 'USD',
    items: [
      { id: 'i1', name: 'A', priceMinor: 333, assignedTo: ['p1', 'p2'] },
      { id: 'i2', name: 'B', priceMinor: 333, assignedTo: ['p3'] },
    ],
    people: [{ id: 'p1', name: '1' }, { id: 'p2', name: '2' }, { id: 'p3', name: '3' }],
    taxMinor: 7,
    tipMinor: 0,
  });
  const sum = bill.totals.people.reduce((total, person) => total + person.totalMinor, 0);
  assert.equal(sum, bill.totals.billTotalMinor);
  assert.equal(bill.totals.assignedMinor, bill.totals.billTotalMinor);
  assert.equal(bill.totals.unassignedMinor, 0);
});

test('finalization: zero-price fully assigned bills are valid', () => {
  const bill = finalizeBill({
    currency: 'ETB',
    items: [{ id: 'i1', name: 'Promo water', priceMinor: 0, assignedTo: ['p1'] }],
    people: [{ id: 'p1', name: 'Dagm' }],
  });
  assert.equal(bill.totals.fullyAssigned, true);
  assert.equal(bill.totals.billTotalMinor, 0);
});

test('finalization: signed discount items accepted and split accurately', () => {
  const bill = finalizeBill({
    currency: 'USD',
    items: [
      { id: 'i1', name: 'Pizza', quantity: 1, priceMinor: 600, assignedTo: ['p1'] },
      { id: 'i2', name: 'Burger', quantity: 1, priceMinor: 450, assignedTo: ['p2'] },
      { id: 'i3', name: 'Discount', quantity: 1, priceMinor: -200, assignedTo: ['p1', 'p2'] },
    ],
    people: [{ id: 'p1', name: 'Dagm' }, { id: 'p2', name: 'Abel' }],
    taxMinor: 85,
    tipMinor: 0,
    printedTotalMinor: 935, // 600 + 450 - 200 + 85 = 935
  });
  assert.equal(bill.taxInclusive, false);
  assert.equal(bill.printedTotalMinor, 935);
  assert.equal(bill.totals.billTotalMinor, 935);
  const p1 = bill.totals.people.find((p) => p.id === 'p1');
  const p2 = bill.totals.people.find((p) => p.id === 'p2');
  assert.equal(p1.totalMinor, 550); // 500 base + 50 pro-rata tax
  assert.equal(p2.totalMinor, 385); // 350 base + 35 pro-rata tax
});

test('finalization: server derives taxInclusive=true when matching inclusive reconciliation', () => {
  const bill = finalizeBill({
    restaurantName: 'Toby Carvery',
    currency: 'USD',
    items: [
      { id: 'i1', name: 'ULSD Sugar Free', quantity: 2, priceMinor: 820, assignedTo: ['p1'] },
      { id: 'i2', name: 'Carvery', quantity: 1, priceMinor: 1079, assignedTo: ['p2'] },
      { id: 'i3', name: 'Ice Cream', quantity: 1, priceMinor: 200, assignedTo: ['p1'] },
      { id: 'i4', name: 'Discount', quantity: 1, priceMinor: -599, assignedTo: ['p2'] },
    ],
    people: [{ id: 'p1', name: 'Dagm' }, { id: 'p2', name: 'Abel' }],
    taxMinor: 367,
    tipMinor: 0,
    printedTotalMinor: 1500, // 820 + 1079 + 200 - 599 = 1500 (tax already included!)
  });
  assert.equal(bill.taxInclusive, true);
  assert.equal(bill.totals.billTotalMinor, 1500); // tax NOT added on top
  const p1 = bill.totals.people.find((p) => p.id === 'p1');
  const p2 = bill.totals.people.find((p) => p.id === 'p2');
  assert.equal(p1.totalMinor, 1020); // 820 + 200
  assert.equal(p2.totalMinor, 480); // 1079 - 599
});

test('finalization: conflicting client taxInclusive is overridden by server reconciliation', () => {
  const bill = finalizeBill({
    currency: 'USD',
    items: [
      { id: 'i1', name: 'Pizza', quantity: 1, priceMinor: 1000, assignedTo: ['p1'] },
    ],
    people: [{ id: 'p1', name: 'Dagm' }],
    taxMinor: 100,
    tipMinor: 0,
    printedTotalMinor: 1100, // clearly exclusive: 1000 + 100 = 1100
    taxInclusive: true, // client sends false claim
  });
  // Server derived truth: false
  assert.equal(bill.taxInclusive, false);
  assert.equal(bill.totals.billTotalMinor, 1100);
});

test('finalization: one additional charge', () => {
  const bill = finalizeBill({
    restaurantName: 'Cafe',
    currency: 'USD',
    items: [
      { id: 'i1', name: 'Item A', priceMinor: 1000, assignedTo: ['p1'] },
      { id: 'i2', name: 'Item B', priceMinor: 3000, assignedTo: ['p2'] },
    ],
    people: [{ id: 'p1', name: 'Dagm' }, { id: 'p2', name: 'Abel' }],
    additionalCharges: [{ name: 'Service Fee', amountMinor: 400 }],
  });
  assert.equal(bill.totals.chargesTotalMinor, 400);
  assert.equal(bill.totals.billTotalMinor, 4400);
  assert.deepEqual(bill.additionalCharges, [{ name: 'Service Fee', amountMinor: 400 }]);
  const p1 = bill.totals.people.find((p) => p.id === 'p1');
  const p2 = bill.totals.people.find((p) => p.id === 'p2');
  assert.equal(p1.totalMinor, 1100); // 1000 + 100
  assert.equal(p2.totalMinor, 3300); // 3000 + 300
  const sum = bill.totals.people.reduce((t, p) => t + p.totalMinor, 0);
  assert.equal(sum, bill.totals.billTotalMinor);
});

test('finalization: multiple additional charges', () => {
  const bill = finalizeBill({
    restaurantName: 'Cafe',
    currency: 'USD',
    items: [
      { id: 'i1', name: 'Item A', priceMinor: 500, assignedTo: ['p1'] },
    ],
    people: [{ id: 'p1', name: 'Dagm' }],
    additionalCharges: [
      { name: 'Delivery Fee', amountMinor: 50 },
      { name: 'Packaging', amountMinor: 25 },
    ],
  });
  assert.equal(bill.totals.chargesTotalMinor, 75);
  assert.equal(bill.totals.billTotalMinor, 575);
  assert.deepEqual(bill.additionalCharges, [
    { name: 'Delivery Fee', amountMinor: 50 },
    { name: 'Packaging', amountMinor: 25 },
  ]);
  assert.equal(bill.totals.people[0].totalMinor, 575);
});

test('finalization: tax + tip + charge', () => {
  const bill = finalizeBill({
    currency: 'ETB',
    items: [
      { id: 'i1', name: 'Dish 1', priceMinor: 3000, assignedTo: ['p1'] },
      { id: 'i2', name: 'Dish 2', priceMinor: 7000, assignedTo: ['p2'] },
    ],
    people: [{ id: 'p1', name: 'Dagm' }, { id: 'p2', name: 'Abel' }],
    taxMinor: 1500,
    tipMinor: 500,
    additionalCharges: [{ name: 'Corkage', amountMinor: 1000 }],
  });
  // Items: 10000, Extra: 1500 + 500 + 1000 = 3000
  // Dagm (30%): 3000 + 900 = 3900
  // Abel (70%): 7000 + 2100 = 9100
  assert.equal(bill.totals.itemsTotalMinor, 10000);
  assert.equal(bill.totals.chargesTotalMinor, 1000);
  assert.equal(bill.totals.billTotalMinor, 13000);
  const p1 = bill.totals.people.find((p) => p.id === 'p1');
  const p2 = bill.totals.people.find((p) => p.id === 'p2');
  assert.equal(p1.totalMinor, 3900);
  assert.equal(p2.totalMinor, 9100);
  const sum = bill.totals.people.reduce((t, p) => t + p.totalMinor, 0);
  assert.equal(sum, bill.totals.billTotalMinor);
});

test('finalization: tax-inclusive + tip + charge', () => {
  const bill = finalizeBill({
    currency: 'USD',
    items: [
      { id: 'i1', name: 'Item', priceMinor: 1000, assignedTo: ['p1'] },
    ],
    people: [{ id: 'p1', name: 'Dagm' }],
    taxMinor: 150, // Informational only
    tipMinor: 50,
    additionalCharges: [{ name: 'Service', amountMinor: 100 }],
    printedTotalMinor: 1150, // 1000 + 50(tip) + 100(charge) = 1150 (tax is inclusive)
  });
  assert.equal(bill.taxInclusive, true);
  assert.equal(bill.totals.billTotalMinor, 1150);
  assert.equal(bill.totals.people[0].totalMinor, 1150);
  assert.deepEqual(bill.additionalCharges, [{ name: 'Service', amountMinor: 100 }]);
});

test('validation: malformed charge rejection', () => {
  const base = structuredClone(validInput);
  const malformedCases = [
    { ...base, additionalCharges: 'not-an-array' },
    { ...base, additionalCharges: [null] },
    { ...base, additionalCharges: [42] },
    { ...base, additionalCharges: [{ amountMinor: 100 }] },
    { ...base, additionalCharges: [{ name: '', amountMinor: 100 }] },
    { ...base, additionalCharges: [{ name: '   ', amountMinor: 100 }] },
    { ...base, additionalCharges: [{ name: 'Fee', amountMinor: -1 }] },
    { ...base, additionalCharges: [{ name: 'Fee', amountMinor: 1.5 }] },
    { ...base, additionalCharges: [{ name: 'Fee', amountMinor: '100' }] },
    { ...base, additionalCharges: [{ name: 'Fee', amountMinor: Number.MAX_SAFE_INTEGER }] },
  ];
  for (const [index, data] of malformedCases.entries()) {
    assert.throws(
      () => validateBillRequest(data),
      (error) => error instanceof BillError && error.code === 'INVALID_BILL',
      `malformed charge case ${index} should throw INVALID_BILL`
    );
  }
});

test('share codes: 8 base58 characters, unbiased enough, validator strict', () => {
  const codes = new Set();
  const counts = new Map();
  for (let i = 0; i < 2000; i++) {
    const code = generateShareCode();
    assert.equal(code.length, SHARE_CODE_LENGTH);
    assert.ok(isValidShareCode(code));
    codes.add(code);
    for (const char of code) counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  assert.ok(codes.size > 1900); // collisions effectively impossible at 58^8
  const expectedAverage = (2000 * SHARE_CODE_LENGTH) / 58;
  for (const count of counts.values()) {
    assert.ok(count > expectedAverage * 0.6 && count < expectedAverage * 1.5);
  }
  for (const bad of ['', 'short', '8Kx92LmQx', '0OIl2345', '8Kx92Lm ', '8kx92lm!', null, undefined, 12345678]) {
    assert.equal(isValidShareCode(bad), false, `should reject ${String(bad)}`);
  }
});

