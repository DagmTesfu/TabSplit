import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate, splitEvenly, splitItemPrice, computePersonTotals } from './split.js';

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

test('allocate: equal weights distribute evenly with largest-remainder leftovers', () => {
  assert.deepEqual(allocate(200, [1, 1, 1]), [67, 67, 66]);
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(1, [1, 1, 1]), [1, 0, 0]);
  assert.deepEqual(allocate(0, [1, 1]), [0, 0]);
  assert.deepEqual(allocate(100, [1, 1]), [50, 50]);
});

test('allocate: proportional weights', () => {
  assert.deepEqual(allocate(100, [1, 3]), [25, 75]);
  assert.deepEqual(allocate(10, [1, 3]), [3, 7]);
  assert.deepEqual(allocate(10, [3, 1]), [8, 2]);
  assert.deepEqual(allocate(1000, [1, 1, 1, 1]), [250, 250, 250, 250]);
  assert.deepEqual(allocate(999, [2, 1, 1]), [499, 250, 250]);
});

test('allocate: zero-weight parties receive nothing and never get leftovers', () => {
  assert.deepEqual(allocate(100, [0, 1, 1]), [0, 50, 50]);
  assert.deepEqual(allocate(1, [0, 1, 1]), [0, 1, 0]);
  assert.deepEqual(allocate(0, [0, 0]), [0, 0]);
  assert.throws(() => allocate(100, [0, 0]), /zero total weight/);
});

test('allocate: deterministic across repeated calls', () => {
  const first = allocate(1000, [3, 2, 7]);
  for (let i = 0; i < 20; i++) assert.deepEqual(allocate(1000, [3, 2, 7]), first);
});

test('allocate: rejects invalid input', () => {
  assert.throws(() => allocate(-1, [1]), Error);
  assert.throws(() => allocate(100, []), Error);
  assert.throws(() => allocate(100, [1, -1]), Error);
  assert.throws(() => allocate(100, 'x'), Error);
  assert.throws(() => allocate(1.5, [1]), Error);
});

test('splitEvenly: basic cases', () => {
  assert.deepEqual(splitEvenly(600, 1), [600]);
  assert.deepEqual(splitEvenly(600, 2), [300, 300]);
  assert.deepEqual(splitEvenly(200, 3), [67, 67, 66]);
  assert.deepEqual(splitEvenly(0, 4), [0, 0, 0, 0]);
  assert.throws(() => splitEvenly(100, 0), Error);
  assert.throws(() => splitEvenly(100, -2), Error);
});

test('splitItemPrice: positive line splitting still works', () => {
  assert.deepEqual(splitItemPrice(600, 1), [600]);
  assert.deepEqual(splitItemPrice(600, 2), [300, 300]);
  assert.deepEqual(splitItemPrice(200, 3), [67, 67, 66]);
  assert.deepEqual(splitItemPrice(0, 2), [0, 0]);
});

test('splitItemPrice: negative line splitting with exact largest remainder (-100 / 3 = -34, -33, -33)', () => {
  assert.deepEqual(splitItemPrice(-200, 2), [-100, -100]);
  assert.deepEqual(splitItemPrice(-100, 3), [-34, -33, -33]);
  assert.deepEqual(splitItemPrice(-1, 3), [-1, -0, -0]);
  assert.equal(sum(splitItemPrice(-100, 3)), -100);
});

test('computePersonTotals: signed discount items reduce assigned person totals', () => {
  const result = computePersonTotals({
    items: [
      { id: 'pizza', name: 'Pizza', priceMinor: 600, assignedTo: ['dagm'] },
      { id: 'burger', name: 'Burger', priceMinor: 450, assignedTo: ['abel'] },
      { id: 'discount', name: 'Discount', priceMinor: -200, assignedTo: ['dagm', 'abel'] },
    ],
    people: [
      { id: 'dagm', name: 'Dagm' },
      { id: 'abel', name: 'Abel' },
    ],
  });
  const dagm = result.people.find((p) => p.id === 'dagm');
  const abel = result.people.find((p) => p.id === 'abel');
  assert.equal(dagm.totalMinor, 500); // 600 - 100
  assert.equal(abel.totalMinor, 350); // 450 - 100
  assert.equal(result.billTotalMinor, 850);
  assert.equal(result.fullyAssigned, true);
});

test('computePersonTotals: tax-inclusive calculation does not double-count tax', () => {
  const result = computePersonTotals({
    items: [
      { id: 'food', name: 'Food', priceMinor: 2000, assignedTo: ['dagm'] },
      { id: 'drink', name: 'Drink', priceMinor: 199, assignedTo: ['abel'] },
    ],
    people: [
      { id: 'dagm', name: 'Dagm' },
      { id: 'abel', name: 'Abel' },
    ],
    taxMinor: 367, // included in food + drink
    tipMinor: 0,
    taxInclusive: true,
  });
  assert.equal(result.billTotalMinor, 2199);
  assert.equal(result.taxInclusive, true);
  assert.equal(sum(result.people.map((p) => p.totalMinor)), 2199);
});

test('computePersonTotals: rejects negative person base subtotal with clear error', () => {
  assert.throws(
    () => computePersonTotals({
      items: [
        { id: 'coffee', name: 'Coffee', priceMinor: 400, assignedTo: ['dagm'] },
        { id: 'discount', name: 'Big Discount', priceMinor: -1000, assignedTo: ['dagm'] },
      ],
      people: [{ id: 'dagm', name: 'Dagm' }],
    }),
    (error) => error.message.includes('negative subtotal after discounts')
  );
});

test('computePersonTotals: rejects negative overall bill total', () => {
  assert.throws(
    () => computePersonTotals({
      items: [
        { id: 'item', name: 'Item', priceMinor: 100, assignedTo: ['dagm'] },
        { id: 'voucher', name: 'Voucher', priceMinor: -500, assignedTo: ['dagm'] },
      ],
      people: [{ id: 'dagm', name: 'Dagm' }],
    }),
    Error
  );
});

test('computePersonTotals: single-person item pays full amount', () => {
  const result = computePersonTotals({
    items: [{ id: 'pizza', name: 'Pizza', priceMinor: 60000, assignedTo: ['dagm'] }],
    people: [{ id: 'dagm', name: 'Dagm' }],
  });
  assert.deepEqual(result.people, [{ id: 'dagm', name: 'Dagm', totalMinor: 60000 }]);
  assert.equal(result.assignedMinor, 60000);
  assert.equal(result.billTotalMinor, 60000);
  assert.equal(result.unassignedMinor, 0);
  assert.equal(result.fullyAssigned, true);
});

test('computePersonTotals: shared item splits equally', () => {
  const result = computePersonTotals({
    items: [{ id: 'fries', name: 'Fries', priceMinor: 20000, assignedTo: ['dagm', 'abel'] }],
    people: [
      { id: 'dagm', name: 'Dagm' },
      { id: 'abel', name: 'Abel' },
    ],
  });
  assert.deepEqual(
    result.people.map((p) => p.totalMinor),
    [10000, 10000]
  );
  assert.equal(result.fullyAssigned, true);
});

test('computePersonTotals: full example from spec with tax and tip', () => {
  const result = computePersonTotals({
    items: [
      { id: 'pizza', name: 'Pizza', priceMinor: 60000, assignedTo: ['dagm'] },
      { id: 'burger', name: 'Burger', priceMinor: 45000, assignedTo: ['abel'] },
      { id: 'coke', name: 'Coke', priceMinor: 8000, assignedTo: ['dagm'] },
      { id: 'fries', name: 'Fries', priceMinor: 20000, assignedTo: ['dagm', 'abel', 'hana'] },
    ],
    people: [
      { id: 'dagm', name: 'Dagm' },
      { id: 'abel', name: 'Abel' },
      { id: 'hana', name: 'Hana' },
    ],
    taxMinor: 1330,
    tipMinor: 2660,
  });
  const dagm = result.people.find((p) => p.id === 'dagm');
  const abel = result.people.find((p) => p.id === 'abel');
  const hana = result.people.find((p) => p.id === 'hana');
  assert.equal(dagm.totalMinor, 76907);
  assert.equal(abel.totalMinor, 53217);
  assert.equal(hana.totalMinor, 6866);
  assert.equal(sum(result.people.map((p) => p.totalMinor)), result.billTotalMinor);
  assert.equal(result.billTotalMinor, 133000 + 1330 + 2660);
  assert.equal(result.fullyAssigned, true);
});

test('computePersonTotals: tax and tip go only to people with assigned items', () => {
  const result = computePersonTotals({
    items: [{ id: 'pizza', name: 'Pizza', priceMinor: 10000, assignedTo: ['dagm'] }],
    people: [
      { id: 'dagm', name: 'Dagm' },
      { id: 'abel', name: 'Abel' },
      { id: 'hana', name: 'Hana' },
    ],
    taxMinor: 1500,
    tipMinor: 500,
  });
  const dagm = result.people.find((p) => p.id === 'dagm');
  assert.equal(dagm.totalMinor, 10000 + 1500 + 500);
  assert.equal(result.people.find((p) => p.id === 'abel').totalMinor, 0);
  assert.equal(result.people.find((p) => p.id === 'hana').totalMinor, 0);
  assert.equal(result.assignedMinor, result.billTotalMinor);
});

test('computePersonTotals: tax and tip reconcile exactly via largest remainder', () => {
  const result = computePersonTotals({
    items: [
      { id: 'a', name: 'A', priceMinor: 333, assignedTo: ['dagm', 'abel'] },
      { id: 'b', name: 'B', priceMinor: 333, assignedTo: ['hana'] },
    ],
    people: [
      { id: 'dagm', name: 'Dagm' },
      { id: 'abel', name: 'Abel' },
      { id: 'hana', name: 'Hana' },
    ],
    taxMinor: 7,
    tipMinor: 0,
  });
  assert.equal(sum(result.people.map((p) => p.totalMinor)), 666 + 7);
  assert.equal(result.fullyAssigned, true);
});

test('computePersonTotals: unassigned items are reported and excluded from totals', () => {
  const result = computePersonTotals({
    items: [
      { id: 'pizza', name: 'Pizza', priceMinor: 60000, assignedTo: ['dagm'] },
      { id: 'mystery', name: 'Mystery', priceMinor: 9000, assignedTo: [] },
    ],
    people: [{ id: 'dagm', name: 'Dagm' }],
    taxMinor: 1000,
  });
  assert.deepEqual(result.unassignedItemIds, ['mystery']);
  assert.equal(result.itemsTotalMinor, 69000);
  assert.equal(result.assignedMinor, 61000);
  assert.equal(result.unassignedMinor, 9000);
  assert.equal(result.assignedMinor + result.unassignedMinor, result.billTotalMinor);
  assert.equal(result.fullyAssigned, false);
});

test('computePersonTotals: if nothing is assigned, tax/tip flow into unassigned minor units', () => {
  const result = computePersonTotals({
    items: [{ id: 'pizza', name: 'Pizza', priceMinor: 60000, assignedTo: [] }],
    people: [
      { id: 'dagm', name: 'Dagm' },
      { id: 'abel', name: 'Abel' },
    ],
    taxMinor: 500,
  });
  assert.deepEqual(result.unassignedItemIds, ['pizza']);
  assert.deepEqual(result.people.map((p) => p.totalMinor), [0, 0]);
  assert.equal(result.unassignedMinor, 60500);
  assert.equal(result.fullyAssigned, false);
});

test('computePersonTotals: missing assignedTo defaults to unassigned', () => {
  const result = computePersonTotals({
    items: [{ id: 'coke', name: 'Coke', priceMinor: 800 }],
    people: [{ id: 'dagm', name: 'Dagm' }],
  });
  assert.deepEqual(result.unassignedItemIds, ['coke']);
  assert.equal(result.people[0].totalMinor, 0);
  assert.equal(result.unassignedMinor, 800);
});

test('computePersonTotals: zero-price items are valid and assignable', () => {
  const result = computePersonTotals({
    items: [{ id: 'free', name: 'Promo water', priceMinor: 0, assignedTo: ['dagm', 'abel'] }],
    people: [
      { id: 'dagm', name: 'Dagm' },
      { id: 'abel', name: 'Abel' },
    ],
  });
  assert.deepEqual(result.people.map((p) => p.totalMinor), [0, 0]);
  assert.equal(result.fullyAssigned, true);
});

test('computePersonTotals: rejects invalid data', () => {
  const people = [
    { id: 'dagm', name: 'Dagm' },
    { id: 'abel', name: 'Abel' },
  ];
  const validItem = (over = {}) => ({
    id: 'pizza',
    name: 'Pizza',
    priceMinor: 60000,
    assignedTo: ['dagm'],
    ...over,
  });

  assert.throws(() => computePersonTotals({ items: [], people: [] }), Error);
  assert.throws(
    () => computePersonTotals({ items: [validItem()], people: [{ id: 'dagm', name: '  ' }] }),
    Error
  );
  assert.throws(
    () => computePersonTotals({ items: [validItem()], people: [{ id: '', name: 'X' }] }),
    Error
  );
  assert.throws(
    () =>
      computePersonTotals({
        items: [validItem()],
        people: [
          { id: 'dagm', name: 'A' },
          { id: 'dagm', name: 'B' },
        ],
      }),
    Error
  );
  assert.throws(
    () => computePersonTotals({ items: [validItem({ name: '' })], people }),
    Error
  );
  assert.throws(
    () => computePersonTotals({ items: [validItem({ priceMinor: -1 })], people }),
    Error
  );
  assert.throws(
    () => computePersonTotals({ items: [validItem({ priceMinor: 10.5 })], people }),
    Error
  );
  assert.throws(
    () => computePersonTotals({ items: [validItem({ assignedTo: ['ghost'] })], people }),
    Error
  );
  assert.throws(
    () => computePersonTotals({ items: [validItem({ assignedTo: ['dagm', 'dagm'] })], people }),
    Error
  );
  assert.throws(
    () => computePersonTotals({ items: [validItem({ assignedTo: 'dagm' })], people }),
    Error
  );
  assert.throws(() => computePersonTotals({ items: [validItem()], people, taxMinor: -5 }), Error);
  assert.throws(() => computePersonTotals({ items: [validItem()], people, tipMinor: 1.5 }), Error);
});

test('computePersonTotals: reordering people preserves totals when extra remainders do not tie', () => {
  const items = [
    { id: 'a', name: 'A', priceMinor: 1001, assignedTo: ['p1', 'p2'] },
    { id: 'b', name: 'B', priceMinor: 1001, assignedTo: ['p2'] },
  ];
  const orderA = computePersonTotals({
    items,
    people: [
      { id: 'p1', name: 'One' },
      { id: 'p2', name: 'Two' },
    ],
    taxMinor: 7,
  });
  const orderB = computePersonTotals({
    items,
    people: [
      { id: 'p2', name: 'Two' },
      { id: 'p1', name: 'One' },
    ],
    taxMinor: 7,
  });
  const byIdA = Object.fromEntries(orderA.people.map((p) => [p.id, p.totalMinor]));
  const byIdB = Object.fromEntries(orderB.people.map((p) => [p.id, p.totalMinor]));
  assert.deepEqual(byIdA, byIdB);
});

test('allocate: large intermediates remain exact', () => {
  const max = Number.MAX_SAFE_INTEGER;
  assert.deepEqual(allocate(max, [max, max]), [4503599627370496, 4503599627370495]);
  assert.deepEqual(splitEvenly(max, 3), [3002399751580331, 3002399751580330, 3002399751580330]);
  for (const bad of [NaN, Infinity, '100', null, max + 1]) {
    assert.throws(() => allocate(bad, [1]));
    assert.throws(() => allocate(100, [bad]));
  }
});

test('splitEvenly: exhaustive small splits reconcile and favor earlier indices', () => {
  for (let amount = 0; amount <= 300; amount++) {
    for (let count = 1; count <= 20; count++) {
      const shares = splitEvenly(amount, count);
      assert.equal(sum(shares), amount);
      assert.ok(shares.every(Number.isSafeInteger));
      assert.ok(shares.every((share) => share >= 0));
      assert.ok(shares[0] - shares[count - 1] <= 1);
      assert.ok(shares.every((share, index) => index === 0 || shares[index - 1] >= share));
    }
  }
});

test('computePersonTotals: rejects duplicate item ids, blank ids and overflowing totals', () => {
  const people = [{ id: 'p', name: 'Person' }];
  const item = { id: 'i', name: 'Item', priceMinor: Number.MAX_SAFE_INTEGER, assignedTo: ['p'] };
  assert.throws(() => computePersonTotals({ people, items: [item, item] }), /Duplicate item id/);
  assert.throws(() => computePersonTotals({ people, items: [{ ...item, id: ' ' }] }), /non-empty id/);
  assert.throws(() => computePersonTotals({ people: [{ id: ' ', name: 'Person' }], items: [] }), /non-empty id/);
  assert.throws(() => computePersonTotals({ people, items: [item], taxMinor: 1 }), /Bill total/);
  assert.throws(() => computePersonTotals({ people, items: [item, { ...item, id: 'j', priceMinor: 1 }] }), /Items total/);
  assert.throws(() => computePersonTotals({ people, items: [], taxMinor: Number.MAX_SAFE_INTEGER, tipMinor: 1 }), /Tax and tip total/);
});

test('computePersonTotals: zero-price unassigned items still require assignment', () => {
  const result = computePersonTotals({
    people: [{ id: 'p', name: 'Person' }],
    items: [{ id: 'i', name: 'Free water', priceMinor: 0 }],
  });
  assert.equal(result.unassignedMinor, 0);
  assert.deepEqual(result.unassignedItemIds, ['i']);
  assert.equal(result.fullyAssigned, false);
});

test('computePersonTotals: empty items and extras without a paid subtotal', () => {
  const people = [{ id: 'p', name: 'Person' }];
  assert.equal(computePersonTotals({ people, items: [] }).billTotalMinor, 0);
  const result = computePersonTotals({ people, items: [], tipMinor: 10 });
  assert.equal(result.assignedMinor, 0);
  assert.equal(result.unassignedMinor, 10);
  assert.equal(result.fullyAssigned, false);
});

test('computePersonTotals: duplicate names stay distinct and frozen inputs are not mutated', () => {
  const bill = Object.freeze({
    people: Object.freeze([
      Object.freeze({ id: 'p1', name: ' Alex ' }),
      Object.freeze({ id: 'p2', name: 'Alex' }),
    ]),
    items: Object.freeze([
      Object.freeze({ id: 'i', name: 'Item', priceMinor: 1, assignedTo: Object.freeze(['p2', 'p1']) }),
    ]),
  });
  const result = computePersonTotals(bill);
  assert.deepEqual(result.people, [
    { id: 'p1', name: 'Alex', totalMinor: 0 },
    { id: 'p2', name: 'Alex', totalMinor: 1 },
  ]);
  assert.equal(bill.people[0].name, ' Alex ');
  assert.deepEqual(computePersonTotals(bill), result);
});

test('computePersonTotals: tied extra minor units follow people input order', () => {
  const people = [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }];
  const items = [{ id: 'i', name: 'Item', priceMinor: 2, assignedTo: ['p1', 'p2'] }];
  assert.deepEqual(computePersonTotals({ people, items, taxMinor: 1 }).people.map((p) => p.totalMinor), [2, 1]);
  assert.deepEqual(computePersonTotals({ people: [...people].reverse(), items, taxMinor: 1 }).people, [
    { id: 'p2', name: 'Two', totalMinor: 2 },
    { id: 'p1', name: 'One', totalMinor: 1 },
  ]);
});

test('property: reconciliation holds for many randomized bills', () => {
  let seed = 42;
  const rand = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let trial = 0; trial < 300; trial++) {
    const people = ['p1', 'p2', 'p3', 'p4'].slice(0, 1 + rand(4)).map((id, i) => ({
      id,
      name: `P${i + 1}`,
    }));
    const items = Array.from({ length: 1 + rand(6) }, (_, i) => ({
      id: `i${i}`,
      name: `Item ${i}`,
      priceMinor: rand(25000),
      assignedTo: people.filter(() => rand(3) !== 0).map((p) => p.id),
    }));
    const result = computePersonTotals({
      items,
      people,
      taxMinor: rand(3000),
      tipMinor: rand(2000),
    });
    assert.equal(sum(result.people.map((p) => p.totalMinor)), result.assignedMinor);
    assert.equal(result.assignedMinor + result.unassignedMinor, result.billTotalMinor);
    assert.ok(result.people.every((p) => p.totalMinor >= 0));
    assert.equal(result.unassignedMinor, sum(items.filter((item) => item.assignedTo.length === 0).map((item) => item.priceMinor)) + (result.assignedMinor === 0 ? result.taxMinor + result.tipMinor : 0));
    assert.equal(result.fullyAssigned, result.unassignedItemIds.length === 0 && result.unassignedMinor === 0);
  }
});
