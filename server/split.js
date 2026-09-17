export function toMinor(value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error('Invalid amount');
  }
  const text = String(value).trim();
  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(text)) {
    throw new Error('Invalid amount: use a non-negative decimal with at most 2 decimal places');
  }
  const [units, decimals = ''] = text.split('.');
  const Minor = BigInt(units || '0') * 100n + BigInt(decimals.padEnd(2, '0'));
  if (Minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large');
  return Number(Minor);
}

function assertValidMinor(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of minor units`);
  }
  return value;
}

export function allocate(totalMinor, weights) {
  assertValidMinor(totalMinor, 'total');
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new Error('weights must be a non-empty array');
  }
  let totalWeight = 0n;
  for (const weight of weights) {
    assertValidMinor(weight, 'weight');
    totalWeight += BigInt(weight);
  }
  if (totalWeight === 0n) {
    if (totalMinor > 0) throw new Error('Cannot allocate a positive amount with zero total weight');
    return weights.map(() => 0);
  }

  const shares = [];
  const remainders = [];
  let distributed = 0;
  for (const weight of weights) {
    const numerator = BigInt(weight) * BigInt(totalMinor);
    const base = Number(numerator / totalWeight);
    shares.push(base);
    remainders.push(numerator % totalWeight);
    distributed += base;
  }
  const leftover = totalMinor - distributed;
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((a, b) => {
      if (a.remainder === b.remainder) return a.index - b.index;
      return a.remainder > b.remainder ? -1 : 1;
    });
  for (let i = 0; i < leftover; i++) shares[order[i].index] += 1;
  return shares;
}

export function splitEvenly(totalMinor, count) {
  assertValidMinor(totalMinor, 'total');
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error('count must be a positive integer');
  }
  return allocate(totalMinor, new Array(count).fill(1));
}

export function computePersonTotals({ items, people, taxMinor = 0, tipMinor = 0 }) {
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
  let itemsTotalMinor = 0;

  for (const item of items) {
    if (!item || typeof item.id !== 'string' || item.id.trim() === '') {
      throw new Error('Every item needs a non-empty id');
    }
    if (itemIds.has(item.id)) throw new Error(`Duplicate item id: ${item.id}`);
    itemIds.add(item.id);
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (name === '') throw new Error(`Item ${item.id} needs a non-empty name`);
    const price = assertValidMinor(item.priceMinor, `Item "${name}" price`);
    itemsTotalMinor += price;
    if (!Number.isSafeInteger(itemsTotalMinor)) throw new Error('Items total is too large');

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

  const tax = assertValidMinor(taxMinor, 'tax');
  const tip = assertValidMinor(tipMinor, 'tip');
  const extra = tax + tip;
  if (!Number.isSafeInteger(extra)) throw new Error('Tax and tip total is too large');

  const billTotalMinor = assertValidMinor(itemsTotalMinor + extra, 'Bill total');
  const ids = [...peopleById.keys()];
  const baseTotals = ids.map((id) => totals.get(id));
  const extraShares = baseTotals.some((amount) => amount > 0)
    ? allocate(extra, baseTotals)
    : baseTotals.map(() => 0);
  const personTotals = ids.map((id, index) => ({
    id,
    name: peopleById.get(id).name,
    totalMinor: baseTotals[index] + extraShares[index],
  }));

  const assignedMinor = personTotals.reduce((sum, person) => sum + person.totalMinor, 0);
  return {
    people: personTotals,
    unassignedItemIds,
    itemsTotalMinor,
    taxMinor: tax,
    tipMinor: tip,
    billTotalMinor,
    assignedMinor,
    unassignedMinor: billTotalMinor - assignedMinor,
    fullyAssigned: unassignedItemIds.length === 0 && billTotalMinor === assignedMinor,
  };
}
