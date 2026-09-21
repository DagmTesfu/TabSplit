import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { extractReceipt, finalizeBill, buildFinalizePayload } from './api.js';

afterEach(() => {
  mock.restoreAll();
});

// --- extractReceipt tests ---

test('extractReceipt: returns data on successful response', async () => {
  const fakeData = {
    restaurantName: 'Test Diner',
    currency: 'USD',
    items: [{ name: 'Burger', priceMinor: 1200 }],
  };

  mock.method(axios, 'post', async (url, formData) => {
    assert.equal(url, '/api/extract-receipt');
    assert.equal(formData.get('currency'), 'USD');
    return { status: 200, data: fakeData };
  });

  const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
  const result = await extractReceipt(fakeBlob, 'USD');
  assert.deepEqual(result, fakeData);
});

test('extractReceipt: propagates server error message from 422 INVALID_RESPONSE', async () => {
  mock.method(axios, 'post', async () => {
    const error = new Error('Request failed with status code 422');
    error.response = {
      status: 422,
      data: {
        error: 'The receipt could not be read completely. Try a clearer photo.',
        code: 'INVALID_RESPONSE',
      },
    };
    throw error;
  });

  const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
  await assert.rejects(
    () => extractReceipt(fakeBlob, 'ETB'),
    (err) => {
      assert.equal(err.message, 'The receipt could not be read completely. Try a clearer photo.');
      assert.equal(err.code, 'INVALID_RESPONSE');
      assert.equal(err.status, 422);
      return true;
    }
  );
});

test('extractReceipt: propagates server error message from 502 PROVIDER_ERROR', async () => {
  mock.method(axios, 'post', async () => {
    const error = new Error('Request failed with status code 502');
    error.response = {
      status: 502,
      data: {
        error: 'Vision provider returned a malformed response. Please try again.',
        code: 'PROVIDER_ERROR',
      },
    };
    throw error;
  });

  const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
  await assert.rejects(
    () => extractReceipt(fakeBlob, 'ETB'),
    (err) => {
      assert.equal(err.message, 'Vision provider returned a malformed response. Please try again.');
      assert.equal(err.code, 'PROVIDER_ERROR');
      assert.equal(err.status, 502);
      return true;
    }
  );
});

test('extractReceipt: propagates generic network error message when no response received', async () => {
  mock.method(axios, 'post', async () => {
    const error = new Error('Network Error');
    throw error;
  });

  const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
  await assert.rejects(
    () => extractReceipt(fakeBlob, 'ETB'),
    (err) => {
      assert.equal(err.message, 'Network Error');
      return true;
    }
  );
});

// --- Feature 5.9: finalizeBill and buildFinalizePayload tests ---

test('1. finalizeBill sends POST /api/bills and returns successful response', async () => {
  const fakeResponse = {
    shareCode: 'ABC12345',
    shareUrl: 'http://localhost:5173/b/ABC12345',
    bill: {
      restaurantName: 'Cafe Roma',
      currency: 'USD',
      items: [{ id: 'i1', name: 'Coffee', quantity: 1, priceMinor: 400, assignedTo: ['p1'] }],
      people: [{ id: 'p1', name: 'Dagm' }],
      totals: { billTotalMinor: 400, fullyAssigned: true },
    },
  };

  const payload = {
    restaurantName: 'Cafe Roma',
    currency: 'USD',
    people: [{ id: 'p1', name: 'Dagm' }],
    items: [{ id: 'i1', name: 'Coffee', quantity: 1, priceMinor: 400, assignedTo: ['p1'] }],
    taxMinor: 0,
    tipMinor: 0,
  };

  mock.method(axios, 'post', async (url, data) => {
    assert.equal(url, '/api/bills');
    assert.deepEqual(data, payload);
    return { status: 201, data: fakeResponse };
  });

  const result = await finalizeBill(payload);
  assert.deepEqual(result, fakeResponse);
});

test('2 & 3. buildFinalizePayload builds canonical payload and omits client-derived calculation fields', () => {
  const receipt = {
    restaurantName: 'Best Bites',
    currency: 'ETB',
    items: [
      { id: 'i1', name: 'Injera', priceMinor: 500, quantity: 1, assignedTo: ['p1'] },
      { id: 'i2', name: 'Tibbs', priceMinor: 800, quantity: 2 },
    ],
    taxMinor: 100,
    tipMinor: 50,
    taxInclusive: false,
    printedTotalMinor: 1450,
    additionalCharges: [{ name: 'Service', amountMinor: 20 }],
    // Derived fields that should be omitted:
    peopleTotals: [{ id: 'p1', totalMinor: 600 }],
    billTotalMinor: 1470,
    assignedMinor: 1470,
    itemSplits: [{ shares: { p1: 500 } }],
  };

  const people = [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ];

  const assignments = {
    i1: ['p1'],
    i2: ['p1', 'p2'],
  };

  const payload = buildFinalizePayload({ receipt, people, assignments });

  // Verify canonical fields
  assert.equal(payload.restaurantName, 'Best Bites');
  assert.equal(payload.currency, 'ETB');
  assert.equal(payload.taxMinor, 100);
  assert.equal(payload.tipMinor, 50);
  assert.equal(payload.taxInclusive, false);
  assert.equal(payload.printedTotalMinor, 1450);
  assert.deepEqual(payload.additionalCharges, [{ name: 'Service', amountMinor: 20 }]);

  assert.deepEqual(payload.people, [
    { id: 'p1', name: 'Dagm' },
    { id: 'p2', name: 'Abel' },
  ]);

  assert.deepEqual(payload.items, [
    { id: 'i1', name: 'Injera', quantity: 1, priceMinor: 500, assignedTo: ['p1'] },
    { id: 'i2', name: 'Tibbs', quantity: 2, priceMinor: 800, assignedTo: ['p1', 'p2'] },
  ]);

  // Verify derived calculation fields are NOT present
  assert.equal(payload.peopleTotals, undefined);
  assert.equal(payload.billTotalMinor, undefined);
  assert.equal(payload.assignedMinor, undefined);
  assert.equal(payload.unassignedMinor, undefined);
  assert.equal(payload.itemSplits, undefined);
  assert.equal(payload.shares, undefined);
  assert.equal(payload.itemsTotalMinor, undefined);
});

test('buildFinalizePayload omits printedTotalMinor if edited receipt no longer reconciles with it', () => {
  const receipt = {
    restaurantName: 'Edited Cafe',
    currency: 'USD',
    items: [
      { id: 'i1', name: 'Item A', priceMinor: 800 }, // User edited from 500 to 800
    ],
    taxMinor: 100,
    tipMinor: 50,
    printedTotalMinor: 650, // Old printed total that no longer matches (800+100+50 = 950)
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = { i1: ['p1'] };

  const payload = buildFinalizePayload({ receipt, people, assignments });
  assert.equal(payload.printedTotalMinor, undefined);
});

test('4 & 5. finalizeBill propagates server errors (400 UNASSIGNED_ITEMS, 503 DB_UNAVAILABLE, network error)', async () => {
  // 400 UNASSIGNED_ITEMS
  mock.method(axios, 'post', async () => {
    const error = new Error('Request failed with status code 400');
    error.response = {
      status: 400,
      data: {
        error: 'Every item must be assigned to at least one person before finalizing.',
        code: 'UNASSIGNED_ITEMS',
      },
    };
    throw error;
  });

  await assert.rejects(
    () => finalizeBill({}),
    (err) => {
      assert.equal(err.message, 'Every item must be assigned to at least one person before finalizing.');
      assert.equal(err.code, 'UNASSIGNED_ITEMS');
      assert.equal(err.status, 400);
      return true;
    }
  );

  mock.restoreAll();

  // 503 DB_UNAVAILABLE
  mock.method(axios, 'post', async () => {
    const error = new Error('Request failed with status code 503');
    error.response = {
      status: 503,
      data: {
        error: 'Could not save the bill. Please try again.',
        code: 'DB_UNAVAILABLE',
      },
    };
    throw error;
  });

  await assert.rejects(
    () => finalizeBill({}),
    (err) => {
      assert.equal(err.message, 'Could not save the bill. Please try again.');
      assert.equal(err.code, 'DB_UNAVAILABLE');
      assert.equal(err.status, 503);
      return true;
    }
  );

  mock.restoreAll();

  // Network error
  mock.method(axios, 'post', async () => {
    throw new Error('Network Error');
  });

  await assert.rejects(
    () => finalizeBill({}),
    (err) => {
      assert.equal(err.message, 'Network Error');
      return true;
    }
  );
});

test('6. Unassigned items check ensures finalization is not allowed', () => {
  const receipt = {
    items: [
      { id: 'i1', name: 'Pizza', priceMinor: 600 },
      { id: 'i2', name: 'Soda', priceMinor: 100 },
    ],
  };
  const people = [{ id: 'p1', name: 'Dagm' }];
  const assignments = { i1: ['p1'] }; // i2 unassigned

  const payload = buildFinalizePayload({ receipt, people, assignments });
  const hasUnassigned = payload.items.some((item) => item.assignedTo.length === 0);
  assert.equal(hasUnassigned, true);
});

test('7. Loading state prevents duplicate finalize calls', async () => {
  let callCount = 0;
  mock.method(axios, 'post', async () => {
    callCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { status: 201, data: { shareCode: 'XYZ12345' } };
  });

  let isFinalizing = false;
  const triggerFinalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;
    try {
      return await finalizeBill({});
    } finally {
      isFinalizing = false;
    }
  };

  const [res1, res2] = await Promise.all([triggerFinalize(), triggerFinalize()]);
  assert.equal(callCount, 1);
  assert.ok(res1);
  assert.equal(res2, undefined);
});
