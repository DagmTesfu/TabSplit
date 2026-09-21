import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAssignments, splitItemPrice, allocate, splitEvenly } from './calculateAssignments.js';

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// --- Server parity tests ---

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

// --- Feature 5.8: Calculation tests ---

test('1. One person, one item', () => {
  const receipt = {
    items: [{ id: 'i1', name: 'Pizza', priceMinor: 600, quantity: 1 }],
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = { i1: ['p1'] };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 600);
  assert.equal(result.billTotalMinor, 600);
  assert.equal(result.assignedMinor, 600);
  assert.equal(result.unassignedMinor, 0);
  assert.equal(result.fullyAssigned, true);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 600, adjustmentMinor: 0, totalMinor: 600 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('2. Two people with separate items', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Pizza', priceMinor: 600, quantity: 1 },
      { id: 'i2', name: 'Burger', priceMinor: 400, quantity: 1 },
    ],
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ];
  const assignments = {
    i1: ['p1'],
    i2: ['p2'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 1000);
  assert.equal(result.billTotalMinor, 1000);
  assert.equal(result.fullyAssigned, true);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 600, adjustmentMinor: 0, totalMinor: 600 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 400, adjustmentMinor: 0, totalMinor: 400 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('3. One item split between two people', () => {
  const receipt = {
    items: [{ id: 'i1', name: 'Nachos', priceMinor: 500, quantity: 1 }],
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ];
  const assignments = { i1: ['p1', 'p2'] };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 500);
  assert.equal(result.billTotalMinor, 500);
  assert.equal(result.fullyAssigned, true);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 250, adjustmentMinor: 0, totalMinor: 250 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 250, adjustmentMinor: 0, totalMinor: 250 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('4. 200 / 3 rounding → 67, 67, 66', () => {
  const receipt = {
    items: [{ id: 'i1', name: 'Appetizer', priceMinor: 200, quantity: 1 }],
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
    { id: 'p3', name: 'Hana' },
  ];
  const assignments = { i1: ['p1', 'p2', 'p3'] };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 200);
  assert.equal(result.billTotalMinor, 200);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 67, adjustmentMinor: 0, totalMinor: 67 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 67, adjustmentMinor: 0, totalMinor: 67 },
    { id: 'p3', name: 'Hana', itemsSubtotalMinor: 66, adjustmentMinor: 0, totalMinor: 66 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('5. Tax-exclusive bill', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Steak', priceMinor: 600, quantity: 1 },
      { id: 'i2', name: 'Salad', priceMinor: 400, quantity: 1 },
    ],
    taxMinor: 150,
    taxInclusive: false,
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ];
  const assignments = {
    i1: ['p1'],
    i2: ['p2'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  // Tax = 150 allocated proportionally: Dagm 60% = 90, Abel 40% = 60
  assert.equal(result.itemsTotalMinor, 1000);
  assert.equal(result.adjustmentTotalMinor, 150);
  assert.equal(result.billTotalMinor, 1150);
  assert.equal(result.taxInclusive, false);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 600, adjustmentMinor: 90, totalMinor: 690 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 400, adjustmentMinor: 60, totalMinor: 460 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('6. Tax-inclusive bill', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Food', priceMinor: 2000, quantity: 1 },
      { id: 'i2', name: 'Drink', priceMinor: 199, quantity: 1 },
    ],
    taxMinor: 367, // Informational only
    taxInclusive: true,
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ];
  const assignments = {
    i1: ['p1'],
    i2: ['p2'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 2199);
  assert.equal(result.adjustmentTotalMinor, 0); // No tip or charges
  assert.equal(result.billTotalMinor, 2199);
  assert.equal(result.taxInclusive, true);
  assert.equal(result.taxMinor, 367);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 2000, adjustmentMinor: 0, totalMinor: 2000 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 199, adjustmentMinor: 0, totalMinor: 199 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('7. Tip', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Item A', priceMinor: 100, quantity: 1 },
      { id: 'i2', name: 'Item B', priceMinor: 300, quantity: 1 },
    ],
    tipMinor: 40,
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ];
  const assignments = {
    i1: ['p1'],
    i2: ['p2'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 400);
  assert.equal(result.adjustmentTotalMinor, 40);
  assert.equal(result.billTotalMinor, 440);
  // Dagm (25%) gets 10, Abel (75%) gets 30
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 100, adjustmentMinor: 10, totalMinor: 110 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 300, adjustmentMinor: 30, totalMinor: 330 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('8. Additional charge', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Item A', priceMinor: 100, quantity: 1 },
      { id: 'i2', name: 'Item B', priceMinor: 300, quantity: 1 },
    ],
    additionalCharges: [
      { name: 'Delivery Fee', amountMinor: 40 },
      { name: 'Packaging', amountMinor: 20 },
    ],
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ];
  const assignments = {
    i1: ['p1'],
    i2: ['p2'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 400);
  assert.equal(result.chargesTotalMinor, 60);
  assert.equal(result.adjustmentTotalMinor, 60);
  assert.equal(result.billTotalMinor, 460);
  // Total charges = 60. Dagm (25%) gets 15, Abel (75%) gets 45
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 100, adjustmentMinor: 15, totalMinor: 115 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 300, adjustmentMinor: 45, totalMinor: 345 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('9. Tax + tip + additional charge', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Item A', priceMinor: 300, quantity: 1 },
      { id: 'i2', name: 'Item B', priceMinor: 700, quantity: 1 },
    ],
    taxMinor: 150,
    tipMinor: 50,
    additionalCharges: [
      { name: 'Service Charge', amountMinor: 100 },
    ],
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ];
  const assignments = {
    i1: ['p1'],
    i2: ['p2'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  // Total adjustment = 150 + 50 + 100 = 300
  // Dagm (30%) gets 90 -> total 390
  // Abel (70%) gets 210 -> total 910
  assert.equal(result.itemsTotalMinor, 1000);
  assert.equal(result.chargesTotalMinor, 100);
  assert.equal(result.adjustmentTotalMinor, 300);
  assert.equal(result.billTotalMinor, 1300);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 300, adjustmentMinor: 90, totalMinor: 390 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 700, adjustmentMinor: 210, totalMinor: 910 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('10. Zero-item person', () => {
  const receipt = {
    items: [{ id: 'i1', name: 'Pizza', priceMinor: 500, quantity: 1 }],
    taxMinor: 50,
    tipMinor: 25,
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' }, // No items assigned
  ];
  const assignments = { i1: ['p1'] };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 500);
  assert.equal(result.billTotalMinor, 575);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 500, adjustmentMinor: 75, totalMinor: 575 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 0, adjustmentMinor: 0, totalMinor: 0 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('11. Negative discount assigned to a person', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Food', priceMinor: 800, quantity: 1 },
      { id: 'i2', name: 'Discount Voucher', priceMinor: -200, quantity: 1 },
      { id: 'i3', name: 'Drink', priceMinor: 400, quantity: 1 },
    ],
    taxMinor: 100,
  };
  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ];
  // Dagm base = 800 - 200 = 600 (60%)
  // Abel base = 400 (40%)
  const assignments = {
    i1: ['p1'],
    i2: ['p1'],
    i3: ['p2'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 1000);
  assert.equal(result.adjustmentTotalMinor, 100);
  assert.equal(result.billTotalMinor, 1100);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 600, adjustmentMinor: 60, totalMinor: 660 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 400, adjustmentMinor: 40, totalMinor: 440 },
  ]);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('12. Unassigned item', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Pizza', priceMinor: 600, quantity: 1 },
      { id: 'i2', name: 'Soda', priceMinor: 150, quantity: 1 },
    ],
    taxMinor: 75,
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = { i1: ['p1'] }; // i2 unassigned

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 750);
  assert.equal(result.assignedTotalMinor, 600);
  assert.equal(result.unassignedTotalMinor, 150);
  assert.deepEqual(result.unassignedItemIds, ['i2']);
  assert.equal(result.fullyAssigned, false);
  assert.equal(result.billTotalMinor, 825);
  assert.equal(result.assignedMinor, 675);
  assert.equal(result.unassignedMinor, 150);
});

test('13. Sum of person totals equals bill total when fully assigned', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Dish 1', priceMinor: 333, quantity: 1 },
      { id: 'i2', name: 'Dish 2', priceMinor: 333, quantity: 1 },
      { id: 'i3', name: 'Dish 3', priceMinor: 334, quantity: 1 },
    ],
    taxMinor: 17,
    tipMinor: 33,
    additionalCharges: [{ name: 'Service', amountMinor: 50 }],
  };
  const people = [
    { id: 'p1', name: 'P1' },
    { id: 'p2', name: 'P2' },
    { id: 'p3', name: 'P3' },
  ];
  const assignments = {
    i1: ['p1'],
    i2: ['p2'],
    i3: ['p3'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.fullyAssigned, true);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
});

test('14. Malformed price/quantity/adjustment values throw rather than silently becoming zero', () => {
  const people = [{ id: 'p1', name: 'Dagm' }];

  // Malformed price
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: '500' }] }, people }),
    /priceMinor must be a safe integer/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 12.5 }] }, people }),
    /priceMinor must be a safe integer/
  );

  // Malformed quantity
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100, quantity: 0 }] }, people }),
    /quantity must be an integer >= 1/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100, quantity: -1 }] }, people }),
    /quantity must be an integer >= 1/
  );

  // Malformed tax/tip
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100 }], taxMinor: -10 }, people }),
    /taxMinor must be a non-negative integer/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100 }], tipMinor: 'foo' }, people }),
    /tipMinor must be a non-negative integer/
  );

  // Malformed additionalCharges
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100 }], additionalCharges: 'string' }, people }),
    /additionalCharges must be an array/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100 }], additionalCharges: [{ name: '', amountMinor: 10 }] }, people }),
    /needs a non-empty name/
  );
  assert.throws(
    () => calculateAssignments({ receipt: { items: [{ id: 'i1', name: 'Item', priceMinor: 100 }], additionalCharges: [{ name: 'Fee', amountMinor: -5 }] }, people }),
    /non-negative integer/
  );

  // Person with negative pre-tax subtotal
  assert.throws(
    () => calculateAssignments({
      receipt: {
        items: [
          { id: 'i1', name: 'Item', priceMinor: 100 },
          { id: 'i2', name: 'Voucher', priceMinor: -500 },
        ],
      },
      people: [{ id: 'p1', name: 'Dagm' }],
      assignments: { i1: ['p1'], i2: ['p1'] },
    }),
    /negative subtotal after discounts/
  );
});

test('15. Deterministic rounding parity with the server', () => {
  // Complex test matching spec full example:
  // Items:
  // - Pizza: 60000 (Dagm)
  // - Burger: 45000 (Abel)
  // - Coke: 8000 (Dagm)
  // - Fries: 20000 (Dagm, Abel, Hana)
  // Tax: 1330
  // Tip: 2660
  const receipt = {
    items: [
      { id: 'pizza', name: 'Pizza', priceMinor: 60000 },
      { id: 'burger', name: 'Burger', priceMinor: 45000 },
      { id: 'coke', name: 'Coke', priceMinor: 8000 },
      { id: 'fries', name: 'Fries', priceMinor: 20000 },
    ],
    taxMinor: 1330,
    tipMinor: 2660,
  };
  const people = [
    { id: 'dagm', name: 'Dagm' },
    { id: 'abel', name: 'Abel' },
    { id: 'hana', name: 'Hana' },
  ];
  const assignments = {
    pizza: ['dagm'],
    burger: ['abel'],
    coke: ['dagm'],
    fries: ['dagm', 'abel', 'hana'],
  };

  const result = calculateAssignments({ receipt, people, assignments });

  const dagm = result.peopleTotals.find((p) => p.id === 'dagm');
  const abel = result.peopleTotals.find((p) => p.id === 'abel');
  const hana = result.peopleTotals.find((p) => p.id === 'hana');

  assert.equal(dagm.totalMinor, 76907);
  assert.equal(abel.totalMinor, 53217);
  assert.equal(hana.totalMinor, 6866);
  assert.equal(sum(result.peopleTotals.map((p) => p.totalMinor)), result.billTotalMinor);
  assert.equal(result.billTotalMinor, 133000 + 1330 + 2660);
  assert.equal(result.fullyAssigned, true);
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
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 600, adjustmentMinor: 0, totalMinor: 600 },
  ]);
  assert.deepEqual(result.itemSplits[0].assignedTo, ['p1']);
});

test('calculateAssignments: duplicate person IDs inside an assignment do not cause double payment', () => {
  const receipt = {
    items: [{ id: 'i1', name: 'Pizza', priceMinor: 600, quantity: 1 }],
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = { i1: ['p1', 'p1', 'p1'] };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 600, adjustmentMinor: 0, totalMinor: 600 },
  ]);
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
    additionalCharges: Object.freeze([
      Object.freeze({ name: 'Service', amountMinor: 20 }),
    ]),
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
  // Total adjustment = 50 + 100 + 20 = 170
  // Dagm base = 500 + 150 = 650 (650/800 * 170 = 138.125 -> 138)
  // Abel base = 150 (150/800 * 170 = 31.875 -> 32)
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 650, adjustmentMinor: 138, totalMinor: 788 },
    { id: 'p2', name: 'Abel', itemsSubtotalMinor: 150, adjustmentMinor: 32, totalMinor: 182 },
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
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 0, adjustmentMinor: 0, totalMinor: 0 },
  ]);
});

// --- Feature 5.12.2: Workflow Edge Cases ---

test('edge case 8: quantity > 1 does not multiply the stored line price', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Draft Beer', quantity: 3, priceMinor: 1500 }, // Total line price is 1500, not 3 * 1500
    ],
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = { i1: ['p1'] };

  const result = calculateAssignments({ receipt, people, assignments });

  assert.equal(result.itemsTotalMinor, 1500);
  assert.equal(result.billTotalMinor, 1500);
  assert.equal(result.peopleTotals[0].totalMinor, 1500);
  assert.equal(result.itemSplits[0].quantity, 3);
  assert.equal(result.itemSplits[0].priceMinor, 1500);
});

test('edge case 9: zero-price items are valid when assigned, but require assignment', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Water (Complimentary)', priceMinor: 0 },
      { id: 'i2', name: 'Coffee', priceMinor: 400 },
    ],
  };
  const people = [{ id: 'p1', name: 'Dagm' }];

  // Case A: i1 is unassigned -> should be unassigned even though price is 0
  const unassignedResult = calculateAssignments({ receipt, people, assignments: { i2: ['p1'] } });
  assert.equal(unassignedResult.fullyAssigned, false);
  assert.deepEqual(unassignedResult.unassignedItemIds, ['i1']);

  // Case B: i1 is assigned -> fully assigned and total is correct
  const assignedResult = calculateAssignments({ receipt, people, assignments: { i1: ['p1'], i2: ['p1'] } });
  assert.equal(assignedResult.fullyAssigned, true);
  assert.equal(assignedResult.unassignedItemIds.length, 0);
  assert.equal(assignedResult.billTotalMinor, 400);
  assert.equal(assignedResult.peopleTotals[0].totalMinor, 400);
});

test('edge case 5 & 6: discount combined with tax-inclusive receipt and additional charges', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Pizza', priceMinor: 1000 },
      { id: 'i2', name: 'Discount Voucher', priceMinor: -200 },
    ],
    taxMinor: 120, // tax-inclusive: informational only
    taxInclusive: true,
    tipMinor: 80,
    additionalCharges: [{ name: 'Service', amountMinor: 40 }],
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = { i1: ['p1'], i2: ['p1'] };

  const result = calculateAssignments({ receipt, people, assignments });

  // itemsTotal = 1000 - 200 = 800
  // adjustment = tip(80) + charges(40) = 120 (tax is inclusive, so not added)
  // billTotal = 800 + 120 = 920
  assert.equal(result.itemsTotalMinor, 800);
  assert.equal(result.adjustmentTotalMinor, 120);
  assert.equal(result.billTotalMinor, 920);
  assert.equal(result.fullyAssigned, true);
  assert.deepEqual(result.peopleTotals, [
    { id: 'p1', name: 'Dagm', itemsSubtotalMinor: 800, adjustmentMinor: 120, totalMinor: 920 },
  ]);
});

