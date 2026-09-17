export function toCents(value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error('Invalid amount');
  }
  const text = String(value).trim();
  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(text)) {
    throw new Error('Invalid amount: use a non-negative decimal with at most 2 decimal places');
  }
  const [units, decimals = ''] = text.split('.');
  const cents = BigInt(units || '0') * 100n + BigInt(decimals.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large');
  return Number(cents);
}

function assertValidCents(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of cents`);
  }
  return value;
}

export function allocate(totalCents, weights) {
  assertValidCents(totalCents, 'total');
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new Error('weights must be a non-empty array');
  }
  let totalWeight = 0n;
  for (const weight of weights) {
    assertValidCents(weight, 'weight');
    totalWeight += BigInt(weight);
  }
  if (totalWeight === 0n) {
    if (totalCents > 0) throw new Error('Cannot allocate a positive amount with zero total weight');
    return weights.map(() => 0);
  }

  const shares = [];
  const remainders = [];
  let distributed = 0;
  for (const weight of weights) {
    const numerator = BigInt(weight) * BigInt(totalCents);
    const base = Number(numerator / totalWeight);
    shares.push(base);
    remainders.push(numerator % totalWeight);
    distributed += base;
  }
  const leftover = totalCents - distributed;
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((a, b) => {
      if (a.remainder === b.remainder) return a.index - b.index;
      return a.remainder > b.remainder ? -1 : 1;
    });
  for (let i = 0; i < leftover; i++) shares[order[i].index] += 1;
  return shares;
}

export function splitEvenly(totalCents, count) {
  assertValidCents(totalCents, 'total');
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error('count must be a positive integer');
  }
  return allocate(totalCents, new Array(count).fill(1));
}

export function computePersonTotals({ items, people, taxCents = 0, tipCents = 0 }) {
  if (!Array.isArray(people) || people.length === 0) {
    throw new Error('At least one person is required');
  }
  if (!Array.isArray(items)) throw new Error('items must be an array');

  const peopleById = new Map();
  for (const person of people) {
    if (!person || typeof person.id !== 'string' || person.id.trim() === '') {
      throw new Error('Every person needs a non-empty id');
    }
    if (peopleById.has(person.id)) throw new Error(`Duplicate person id: ${person.id}`);
    const name = typeof person.name === 'string' ? person.name.trim() : '';
    if (name === '') throw new Error(`Person ${person.id} needs a non-empty name`);
    peopleById.set(person.id, { id: person.id, name });
  }

  const totals = new Map([...peopleById.keys()].map((id) => [id, 0]));
  const unassignedItemIds = [];
  const itemIds = new Set();
  let itemsTotalCents = 0;

  for (const item of items) {
    if (!item || typeof item.id !== 'string' || item.id.trim() === '') {
      throw new Error('Every item needs a non-empty id');
    }
    if (itemIds.has(item.id)) throw new Error(`Duplicate item id: ${item.id}`);
    itemIds.add(item.id);
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (name === '') throw new Error(`Item ${item.id} needs a non-empty name`);
    const price = assertValidCents(item.priceCents, `Item "${name}" price`);
    itemsTotalCents += price;
    if (!Number.isSafeInteger(itemsTotalCents)) throw new Error('Items total is too large');

    const assignedTo = item.assignedTo ?? [];
    if (!Array.isArray(assignedTo)) {
      throw new Error(`Item "${name}" assignedTo must be an array of person ids`);
    }
    const assignees = [];
    for (const personId of assignedTo) {
      if (!peopleById.has(personId)) {
        throw new Error(`Item "${name}" references unknown person: ${personId}`);
      }
      if (assignees.includes(personId)) {
        throw new Error(`Item "${name}" lists person ${personId} more than once`);
      }
      assignees.push(personId);
    }
    if (assignees.length === 0) {
      unassignedItemIds.push(item.id);
      continue;
    }
    const shares = splitEvenly(price, assignees.length);
    assignees.forEach((personId, index) => {
      totals.set(personId, totals.get(personId) + shares[index]);
    });
  }

  const tax = assertValidCents(taxCents, 'tax');
  const tip = assertValidCents(tipCents, 'tip');
  const extra = tax + tip;
  if (!Number.isSafeInteger(extra)) throw new Error('Tax and tip total is too large');

  const billTotalCents = assertValidCents(itemsTotalCents + extra, 'Bill total');
  const ids = [...peopleById.keys()];
  const baseTotals = ids.map((id) => totals.get(id));
  const extraShares = baseTotals.some((amount) => amount > 0)
    ? allocate(extra, baseTotals)
    : baseTotals.map(() => 0);
  const personTotals = ids.map((id, index) => ({
    id,
    name: peopleById.get(id).name,
    totalCents: baseTotals[index] + extraShares[index],
  }));

  const assignedCents = personTotals.reduce((sum, person) => sum + person.totalCents, 0);
  return {
    people: personTotals,
    unassignedItemIds,
    itemsTotalCents,
    taxCents: tax,
    tipCents: tip,
    billTotalCents,
    assignedCents,
    unassignedCents: billTotalCents - assignedCents,
    fullyAssigned: unassignedItemIds.length === 0 && billTotalCents === assignedCents,
  };
}
