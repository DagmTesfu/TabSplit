import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAssignments, splitItemPrice, allocate, splitEvenly } from './calculateAssignments.js';

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

test('parity with server: equal weights distribute evenly with largest-remainder leftovers', () => {
  assert.deepEqual(allocate(200, [1, 1, 1]), [67, 67, 66]);
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(1, [1, 1, 1]), [1, 0, 0]);
  assert.deepEqual(allocate(0, [1, 1]), [0, 0]);
  assert.deepEqual(allocate(100, [1, 1]), [50, 50]);
});

test('parity with server: proportional weights allocation', () => {
  assert.deepEqual(allocate(100, [1, 3]), [25, 75]);
  assert.deepEqual(allocate(10, [1, 3]), [3, 7]);
  assert.deepEqual(allocate(10, [3, 1]), [8, 2]);
  assert.deepEqual(allocate(1000, [1, 1, 1, 1]), [250, 250, 250, 250]);
  assert.deepEqual(allocate(999, [2, 1, 1]), [499, 250, 250]);
});

test('parity with server: splitEvenly exact examples', () => {
  assert.deepEqual(splitEvenly(600, 1), [600]);
  assert.deepEqual(splitEvenly(600, 2), [300, 300]);
  assert.deepEqual(splitEvenly(200, 3), [67, 67, 66]);
  assert.deepEqual(splitEvenly(599, 2), [300, 299]);
  assert.deepEqual(splitEvenly(600, 4), [150, 150, 150, 150]);
  assert.deepEqual(splitEvenly(0, 4), [0, 0, 0, 0]);
  assert.throws(() => splitEvenly(100, 0), Error);
  assert.throws(() => splitEvenly(100, -2), Error);
});

test('parity with server: splitItemPrice positive lines', () => {
  assert.deepEqual(splitItemPrice(600, 1), [600]);
  assert.deepEqual(splitItemPrice(600, 2), [300, 300]);
  assert.deepEqual(splitItemPrice(200, 3), [67, 67, 66]);
  assert.deepEqual(splitItemPrice(599, 2), [300, 299]);
  assert.deepEqual(splitItemPrice(600, 4), [150, 150, 150, 150]);
  assert.deepEqual(splitItemPrice(0, 2), [0, 0]);
});

test('parity with server: splitItemPrice negative discounts with exact largest remainder', () => {
  assert.deepEqual(splitItemPrice(-200, 2), [-100, -100]);
  assert.deepEqual(splitItemPrice(-200, 3), [-67, -67, -66]);
  assert.deepEqual(splitItemPrice(-599, 2), [-300, -299]);
  assert.deepEqual(splitItemPrice(-100, 3), [-34, -33, -33]);
  assert.deepEqual(splitItemPrice(-1, 3), [-1, -0, -0]);
  assert.equal(sum(splitItemPrice(-100, 3)), -100);
  assert.equal(sum(splitItemPrice(-599, 2)), -599);
});

test('calculateAssignments: basic assignment with 1 person pays full amount', () => {
  const receipt = {
    items: [{ id: 'i1', name: 'Pizza', priceMinor: 600, quantity: 1 }],
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = { i1: ['p1'] };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.assignedTotalMinor, 600);
  assert.equal(result.unassignedTotalMinor, 0);
  assert.equal(result.fullyAssigned, true);
  assert.deepEqual(result.peopleTotals, [{ id: 'p1', name: 'Dagm', totalMinor: 600 }]);
  assert.equal(result.itemSplits.length, 1);
  assert.equal(result.itemSplits[0].shares.p1, 600);
  assert.equal(result.itemSplits[0].isAssigned, true);
});

test('calculateAssignments: unassigned item remains in unassignedTotalMinor', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Pizza', priceMinor: 600, quantity: 1 },
      { id: 'i2', name: 'Soda', priceMinor: 150, quantity: 1 },
    ],
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = { i1: ['p1'] }; // i2 is unassigned

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.assignedTotalMinor, 600);
  assert.equal(result.unassignedTotalMinor, 150);
  assert.equal(result.fullyAssigned, false);
  assert.deepEqual(result.peopleTotals, [{ id: 'p1', name: 'Dagm', totalMinor: 600 }]);
  assert.equal(result.itemSplits[1].isAssigned, false);
  assert.deepEqual(result.itemSplits[1].assignedTo, []);
});

test('calculateAssignments: multiple items split across multiple people with discounts', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Pizza', priceMinor: 600, quantity: 1 },
      { id: 'i2', name: 'Burger', priceMinor: 450, quantity: 1 },
      { id: 'i3', name: 'Discount Voucher', priceMinor: -200, quantity: 1 },
    ],
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
    { id: 'p3', name: 'Hana' },
  ];
  // i1 split between Dagm and Abel (300 each)
  // i2 assigned to Hana (450)
  // i3 split between Dagm and Abel (-100 each)
  const assignments = {
    i1: ['p1', 'p2'],
    i2: ['p3'],
    i3: ['p1', 'p2'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.assignedTotalMinor, 850);
  assert.equal(result.unassignedTotalMinor, 0);
  assert.equal(result.fullyAssigned, true);

  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', totalMinor: 200 }, // 300 - 100
    { id: 'p2', name: 'Abel', totalMinor: 200 }, // 300 - 100
    { id: 'p3', name: 'Hana', totalMinor: 450 }, // 450
  ]);
});

test('calculateAssignments: person with no assigned items appears with total 0', () => {
  const receipt = {
    items: [{ id: 'i1', name: 'Pizza', priceMinor: 600, quantity: 1 }],
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ];
  const assignments = { i1: ['p1'] };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', totalMinor: 600 },
    { id: 'p2', name: 'Abel', totalMinor: 0 },
  ]);
});

test('calculateAssignments: unknown item IDs and unknown person IDs are safely filtered', () => {
  const receipt = {
    items: [{ id: 'i1', name: 'Pizza', priceMinor: 600, quantity: 1 }],
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = {
    i1: ['p1', 'unknown_person'],
    unknown_item: ['p1'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.assignedTotalMinor, 600);
  assert.equal(result.unassignedTotalMinor, 0);
  assert.equal(result.fullyAssigned, true);
  assert.deepEqual(result.peopleTotals, [{ id: 'p1', name: 'Dagm', totalMinor: 600 }]);
  assert.deepEqual(result.itemSplits[0].assignedTo, ['p1']);
});

test('calculateAssignments: duplicate person IDs inside an assignment do not cause double payment', () => {
  const receipt = {
    items: [{ id: 'i1', name: 'Pizza', priceMinor: 600, quantity: 1 }],
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = { i1: ['p1', 'p1', 'p1'] };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.deepEqual(result.peopleTotals, [{ id: 'p1', name: 'Dagm', totalMinor: 600 }]);
  assert.deepEqual(result.itemSplits[0].assignedTo, ['p1']);
  assert.equal(result.itemSplits[0].shares.p1, 600);
});

test('calculateAssignments: inputs are not mutated', () => {
  const receipt = Object.freeze({
    restaurantName: 'Test Cafe',
    currency: 'USD',
    taxMinor: 50,
    taxInclusive: false,
    tipMinor: 100,
    items: Object.freeze([
      Object.freeze({ id: 'i1', name: 'Item 1', priceMinor: 500, quantity: 1 }),
      Object.freeze({ id: 'i2', name: 'Item 2', priceMinor: 300, quantity: 1 }),
    ]),
  });
  const people = Object.freeze([
    Object.freeze({ id: 'p1', name: 'Dagm' }),
    Object.freeze({ id: 'p2', name: 'Abel' }),
  ]);
  const assignments = Object.freeze({
    i1: Object.freeze(['p1']),
    i2: Object.freeze(['p1', 'p2']),
  });

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.fullyAssigned, true);
  assert.equal(result.assignedTotalMinor, 800);
  assert.equal(result.unassignedTotalMinor, 0);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', totalMinor: 650 }, // 500 + 150
    { id: 'p2', name: 'Abel', totalMinor: 150 }, // 150
  ]);
});

test('calculateAssignments: empty receipt is not treated as fully assigned', () => {
  const receipt = { items: [] };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = {};

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.fullyAssigned, false);
  assert.equal(result.assignedTotalMinor, 0);
  assert.equal(result.unassignedTotalMinor, 0);
  assert.deepEqual(result.peopleTotals, [{ id: 'p1', name: 'Dagm', totalMinor: 0 }]);
});

test('calculateAssignments: rejects malformed item priceMinor instead of defaulting to 0', () => {
  const people = [{ id: 'p1', name: 'Dagm' }];

  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: '500' }] }, people }),
    /priceMinor must be a safe integer/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: null }] }, people }),
    /priceMinor must be a safe integer/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 12.5 }] }, people }),
    /priceMinor must be a safe integer/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: NaN }] }, people }),
    /priceMinor must be a safe integer/
  );
});

test('calculateAssignments: rejects malformed item quantity instead of defaulting to 1', () => {
  const people = [{ id: 'p1', name: 'Dagm' }];

  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100, quantity: 0 }] }, people }),
    /quantity must be an integer >= 1/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100, quantity: -2 }] }, people }),
    /quantity must be an integer >= 1/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100, quantity: 1.5 }] }, people }),
    /quantity must be an integer >= 1/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100, quantity: '2' }] }, people }),
    /quantity must be an integer >= 1/
  );
});

test('calculateAssignments: rejects malformed taxMinor or tipMinor', () => {
  const receipt = { items: [{ id: 'i1', name: 'Item', priceMinor: 100 }] };
  const people = [{ id: 'p1', name: 'Dagm' }];

  assert.throws(
    () => calculateAssignments({ receipt: { ...receipt, taxMinor: -50 }, people }),
    /taxMinor must be a non-negative integer/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { ...receipt, taxMinor: 12.5 }, people }),
    /taxMinor must be a non-negative integer/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { ...receipt, tipMinor: '100' }, people }),
    /tipMinor must be a non-negative integer/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { ...receipt, tipMinor: -10 }, people }),
    /tipMinor must be a non-negative integer/
  );
});
