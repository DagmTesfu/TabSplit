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
 * Pure calculation layer for client item assignment and summary totals.
 * Accepts receipt, people, and assignments state, and returns deterministic totals and splits.
 *
 * Strict financial validation:
 * - Throws if item.priceMinor is not a safe integer.
 * - Throws if item.quantity is not an integer >= 1.
 * - Throws if taxMinor, tipMinor, or additionalCharges is invalid.
 * - Throws if any person's pre-tax subtotal is negative after discounts.
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

  // Validate tax and tip
  const taxMinor = receipt.taxMinor !== undefined && receipt.taxMinor !== null
    ? assertValidMinor(receipt.taxMinor, 'taxMinor')
    : 0;
  const tipMinor = receipt.tipMinor !== undefined && receipt.tipMinor !== null
    ? assertValidMinor(receipt.tipMinor, 'tipMinor')
    : 0;
  const isTaxInclusive = Boolean(receipt.taxInclusive);

  // Validate additional charges
  const additionalCharges = receipt.additionalCharges ?? [];
  if (!Array.isArray(additionalCharges)) {
    throw new Error('additionalCharges must be an array');
  }

  let chargesTotalMinor = 0;
  const validatedCharges = [];
  for (let i = 0; i < additionalCharges.length; i++) {
    const charge = additionalCharges[i];
    if (!charge || typeof charge !== 'object' || Array.isArray(charge)) {
      throw new Error(`Charge at index ${i} must be an object`);
    }
    const name = typeof charge.name === 'string' ? charge.name.trim() : '';
    if (name === '') {
      throw new Error(`Charge at index ${i} needs a non-empty name`);
    }
    if (!Number.isSafeInteger(charge.amountMinor) || charge.amountMinor < 0) {
      throw new Error(`Charge "${name}" amountMinor must be a non-negative integer number of minor units`);
    }
    chargesTotalMinor += charge.amountMinor;
    if (!Number.isSafeInteger(chargesTotalMinor)) {
      throw new Error('Additional charges total is too large');
    }
    validatedCharges.push({ name, amountMinor: charge.amountMinor });
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

  let itemsTotalMinor = 0;
  let assignedTotalMinor = 0;
  let unassignedTotalMinor = 0;
  const unassignedItemIds = [];
  const itemSplits = [];
  const itemIds = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      throw new Error('Each receipt item must be an object');
    }
    const itemId = item.id;
    if (typeof itemId !== 'string' || itemId.trim() === '') {
      throw new Error('Every item needs a non-empty id');
    }
    if (itemIds.has(itemId)) {
      throw new Error(`Duplicate item id: ${itemId}`);
    }
    itemIds.add(itemId);

    if (!Number.isSafeInteger(item.priceMinor)) {
      throw new Error(`Item "${item.name || itemId}" priceMinor must be a safe integer number of minor units`);
    }
    const priceMinor = item.priceMinor;
    itemsTotalMinor += priceMinor;
    if (!Number.isSafeInteger(itemsTotalMinor)) {
      throw new Error('Items total is too large');
    }

    const name = typeof item.name === 'string' ? item.name : '';
    const quantity = item.quantity === undefined || item.quantity === null ? 1 : item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new Error(`Item "${name || itemId}" quantity must be an integer >= 1`);
    }

    // Retrieve and sanitize assigned person IDs (filtering duplicates and unknown IDs)
    const rawAssigned = assignments[itemId] !== undefined
      ? assignments[itemId]
      : (Array.isArray(item.assignedTo) ? item.assignedTo : []);

    const sanitizedAssigned = [];
    if (Array.isArray(rawAssigned)) {
      for (const personId of rawAssigned) {
        if (typeof personId === 'string' && validPeopleMap.has(personId) && !sanitizedAssigned.includes(personId)) {
          sanitizedAssigned.push(personId);
        }
      }
    }

    if (sanitizedAssigned.length === 0) {
      unassignedItemIds.push(itemId);
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

  // Reject if any person's pre-tax assigned subtotal is negative
  for (const person of validPeopleMap.values()) {
    const personBaseTotal = personTotalsMap.get(person.id) ?? 0;
    if (personBaseTotal < 0) {
      throw new Error(`Person "${person.name}" has a negative subtotal after discounts (${personBaseTotal}). Discounts cannot exceed that person's assigned items.`);
    }
  }

  // Calculate extra adjustment amount
  const adjustmentTotalMinor = isTaxInclusive
    ? tipMinor + chargesTotalMinor
    : taxMinor + tipMinor + chargesTotalMinor;

  if (!Number.isSafeInteger(adjustmentTotalMinor)) {
    throw new Error('Tax, tip, and additional charges total is too large');
  }

  const billTotalMinor = itemsTotalMinor + adjustmentTotalMinor;
  if (!Number.isSafeInteger(billTotalMinor) || billTotalMinor < 0) {
    throw new Error('Bill total must be a non-negative integer number of minor units');
  }

  // Proportional adjustment allocation based on positive person item subtotals
  const ids = people
    .filter((p) => p && typeof p.id === 'string' && validPeopleMap.has(p.id))
    .map((p) => p.id);

  const baseTotals = ids.map((id) => personTotalsMap.get(id) ?? 0);
  const adjustmentShares = baseTotals.some((amount) => amount > 0)
    ? allocate(adjustmentTotalMinor, baseTotals)
    : baseTotals.map(() => 0);

  const peopleTotals = ids.map((id, index) => {
    const itemsSubtotalMinor = baseTotals[index];
    const adjustmentMinor = adjustmentShares[index];
    return {
      id,
      name: validPeopleMap.get(id).name,
      itemsSubtotalMinor,
      adjustmentMinor,
      totalMinor: itemsSubtotalMinor + adjustmentMinor,
    };
  });

  const assignedMinor = peopleTotals.reduce((sum, p) => sum + p.totalMinor, 0);
  const unassignedMinor = billTotalMinor - assignedMinor;
  const fullyAssigned = items.length > 0 && unassignedItemIds.length === 0 && billTotalMinor === assignedMinor;

  return {
    peopleTotals,
    itemSplits,
    itemsTotalMinor,
    assignedTotalMinor,
    unassignedTotalMinor,
    chargesTotalMinor,
    adjustmentTotalMinor,
    billTotalMinor,
    assignedMinor,
    unassignedMinor,
    unassignedItemIds,
    fullyAssigned,
    taxMinor,
    taxInclusive: isTaxInclusive,
    tipMinor,
    additionalCharges: validatedCharges,
  };
}
