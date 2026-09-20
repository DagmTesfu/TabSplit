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

export function splitItemPrice(priceMinor, count) {
  if (!Number.isSafeInteger(priceMinor)) {
    throw new Error('priceMinor must be a safe integer');
  }
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error('count must be a positive integer');
  }
  if (priceMinor < 0) {
    return splitEvenly(-priceMinor, count).map((share) => -share);
  }
  return splitEvenly(priceMinor, count);
}

/**
 * Pure calculation layer for client item assignment.
 * Accepts receipt, people, and assignments state, and returns deterministic totals and splits.
 *
 * Strict financial validation:
 * - Throws if item.priceMinor is not a safe integer.
 * - Throws if item.quantity is not an integer >= 1.
 * - Throws if taxMinor or tipMinor is invalid when provided.
 */
export function calculateAssignments({ receipt = {}, people = [], assignments = {} } = {}) {
  if (receipt !== null && typeof receipt !== 'object') {
    throw new Error('receipt must be an object');
  }
  if (!Array.isArray(people)) {
    throw new Error('people must be an array');
  }
  if (assignments !== null && typeof assignments !== 'object') {
    throw new Error('assignments must be an object');
  }

  const items = receipt.items ?? [];
  if (!Array.isArray(items)) {
    throw new Error('receipt.items must be an array');
  }

  // Validate adjustment fields if present
  if (receipt.taxMinor !== undefined && (!Number.isSafeInteger(receipt.taxMinor) || receipt.taxMinor < 0)) {
    throw new Error('taxMinor must be a non-negative integer number of minor units');
  }
  if (receipt.tipMinor !== undefined && (!Number.isSafeInteger(receipt.tipMinor) || receipt.tipMinor < 0)) {
    throw new Error('tipMinor must be a non-negative integer number of minor units');
  }

  // Build a lookup for valid people IDs to filter unknown IDs and preserve input order
  const validPeopleMap = new Map();
  people.forEach((p) => {
    if (p && typeof p.id === 'string' && p.id.trim() !== '') {
      validPeopleMap.set(p.id, {
        id: p.id,
        name: typeof p.name === 'string' ? p.name.trim() : '',
      });
    }
  });

  // Track each person's accumulated item total
  const personTotalsMap = new Map();
  validPeopleMap.forEach((_, id) => {
    personTotalsMap.set(id, 0);
  });

  let assignedTotalMinor = 0;
  let unassignedTotalMinor = 0;
  const itemSplits = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new Error('Each receipt item must be an object');
    }
    const itemId = item.id;
    if (typeof itemId !== 'string' || itemId.trim() === '') {
      throw new Error('Every item needs a non-empty id');
    }
    if (!Number.isSafeInteger(item.priceMinor)) {
      throw new Error(`Item "${item.name || itemId}" priceMinor must be a safe integer number of minor units`);
    }
    const priceMinor = item.priceMinor;
    const name = typeof item.name === 'string' ? item.name : '';

    const quantity = item.quantity === undefined ? 1 : item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new Error(`Item "${name || itemId}" quantity must be an integer >= 1`);
    }

    // Retrieve and sanitize assigned person IDs (filtering duplicates and unknown IDs)
    const rawAssigned = Array.isArray(assignments[itemId]) ? assignments[itemId] : [];
    const sanitizedAssigned = [];
    for (const personId of rawAssigned) {
      if (typeof personId === 'string' && validPeopleMap.has(personId) && !sanitizedAssigned.includes(personId)) {
        sanitizedAssigned.push(personId);
      }
    }

    if (sanitizedAssigned.length === 0) {
      unassignedTotalMinor += priceMinor;
      itemSplits.push({
        id: itemId,
        name,
        quantity,
        priceMinor,
        assignedTo: [],
        shares: {},
        isAssigned: false,
      });
    } else {
      assignedTotalMinor += priceMinor;
      const splitShares = splitItemPrice(priceMinor, sanitizedAssigned.length);
      const sharesObj = {};

      sanitizedAssigned.forEach((personId, idx) => {
        const share = splitShares[idx];
        sharesObj[personId] = share;
        personTotalsMap.set(personId, personTotalsMap.get(personId) + share);
      });

      itemSplits.push({
        id: itemId,
        name,
        quantity,
        priceMinor,
        assignedTo: [...sanitizedAssigned],
        shares: sharesObj,
        isAssigned: true,
      });
    }
  }

  const peopleTotals = people
    .filter((p) => p && typeof p.id === 'string' && validPeopleMap.has(p.id))
    .map((p) => ({
      id: p.id,
      name: validPeopleMap.get(p.id).name,
      totalMinor: personTotalsMap.get(p.id) ?? 0,
    }));

  const fullyAssigned = items.length > 0 && itemSplits.every((split) => split.isAssigned);

  return {
    peopleTotals,
    itemSplits,
    assignedTotalMinor,
    unassignedTotalMinor,
    fullyAssigned,
    // Context fields preserved for downstream slices
    taxMinor: receipt.taxMinor ?? 0,
    taxInclusive: Boolean(receipt.taxInclusive),
    tipMinor: receipt.tipMinor ?? 0,
    additionalCharges: Array.isArray(receipt.additionalCharges) ? receipt.additionalCharges : [],
  };
}
