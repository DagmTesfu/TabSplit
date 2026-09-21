import test, { mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { extractReceipt, finalizeBill, getBill, buildFinalizePayload } from './api.js';

afterEach(() => {
  mock.restoreAll();
});

test('1. Start scanning and tap Scan repeatedly (duplicate prevention)', async () => {
  let callCount = 0;
  mock.method(axios, 'post', async () => {
    callCount++;
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      data: {
        currency: 'USD',
        items: [{ id: '1', name: 'Item', priceMinor: 1000, quantity: 1 }],
      },
    };
  });

  const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });

  // Simulate ScanPage handleScan logic with multi-tap guard:
  let isScanning = false;
  let requestsInitiated = 0;

  const handleScan = async () => {
    if (isScanning || !fakeBlob) return;
    isScanning = true;
    requestsInitiated++;
    try {
      await extractReceipt(fakeBlob, 'USD');
    } finally {
      isScanning = false;
    }
  };

  // User taps 5 times in rapid succession while first request is active
  const tap1 = handleScan();
  const tap2 = handleScan();
  const tap3 = handleScan();
  const tap4 = handleScan();
  const tap5 = handleScan();

  await Promise.all([tap1, tap2, tap3, tap4, tap5]);

  assert.equal(requestsInitiated, 1, 'Only 1 request was initiated despite 5 rapid taps');
  assert.equal(callCount, 1, 'Only 1 axios.post call was made');
});

test('2. Let a scan fail and confirm Try Again works without reselecting image', async () => {
  let attempt = 0;
  mock.method(axios, 'post', async () => {
    attempt++;
    if (attempt === 1) {
      const error = new Error('502 Bad Gateway');
      error.response = {
        status: 502,
        data: { error: 'OpenRouter service is temporarily unavailable.', code: 'PROVIDER_ERROR' },
      };
      throw error;
    }
    return {
      data: {
        currency: 'USD',
        items: [{ id: 'item_1', name: 'Coffee', priceMinor: 450, quantity: 1 }],
      },
    };
  });

  const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
  let receiptFile = fakeBlob;
  let currency = 'USD';
  let scanError = null;
  let result = null;

  // First Attempt (fails)
  try {
    result = await extractReceipt(receiptFile, currency);
  } catch (err) {
    scanError = err.message;
  }

  assert.equal(scanError, 'OpenRouter service is temporarily unavailable.');
  assert.equal(result, null);
  assert.equal(receiptFile, fakeBlob, 'Image is still preserved in state on failure');
  assert.equal(currency, 'USD', 'Currency is still preserved in state on failure');

  // Second Attempt ("Try Again" without reselecting image)
  scanError = null;
  try {
    result = await extractReceipt(receiptFile, currency);
  } catch (err) {
    scanError = err.message;
  }

  assert.equal(scanError, null);
  assert.notEqual(result, null);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, 'Coffee');
  assert.equal(attempt, 2);
});

test('3. Test large image > 5 MB rejection on client and server', async () => {
  const maxSize = 5 * 1024 * 1024; // 5 MB
  const oversizeBytes = 6 * 1024 * 1024; // 6 MB

  // Client-side validation logic check (from ScanPage)
  const oversizedFile = { size: oversizeBytes, type: 'image/jpeg' };
  let clientFileError = null;
  if (oversizedFile.size > maxSize) {
    clientFileError = 'Receipt image must be 5 MB or smaller.';
  }
  assert.equal(clientFileError, 'Receipt image must be 5 MB or smaller.');

  // Server-side response contract check (413 IMAGE_TOO_LARGE)
  mock.method(axios, 'post', async () => {
    const error = new Error('Payload too large');
    error.response = {
      status: 413,
      data: { error: 'Image is too large (max 5 MB).', code: 'IMAGE_TOO_LARGE' },
    };
    throw error;
  });

  const fakeOversizedBlob = new Blob(['x'.repeat(100)], { type: 'image/jpeg' });
  await assert.rejects(
    () => extractReceipt(fakeOversizedBlob, 'USD'),
    (err) => {
      assert.equal(err.status, 413);
      assert.equal(err.code, 'IMAGE_TOO_LARGE');
      assert.equal(err.message, 'Image is too large (max 5 MB).');
      return true;
    }
  );
});

test('4. Disconnect network and scan', async () => {
  mock.method(axios, 'post', async () => {
    const networkErr = new Error('Network Error');
    networkErr.request = {}; // request sent but no response
    throw networkErr;
  });

  const fakeBlob = new Blob(['image-data'], { type: 'image/jpeg' });
  await assert.rejects(
    () => extractReceipt(fakeBlob, 'USD'),
    (err) => {
      assert.equal(err.code, 'NETWORK_ERROR');
      assert.equal(err.message, 'Network Error');
      return true;
    }
  );
});

test('5. Finalize with network disconnected and confirm bill state remains', async () => {
  const receipt = {
    currency: 'USD',
    items: [{ id: 'i1', name: 'Burger', priceMinor: 1000, quantity: 1 }],
  };
  const people = [{ id: 'p1', name: 'Alice' }];
  const assignments = { i1: ['p1'] };

  mock.method(axios, 'post', async () => {
    const networkErr = new Error('Network Error');
    networkErr.request = {};
    throw networkErr;
  });

  let isFinalizing = false;
  let submitError = null;
  let navigated = false;

  // Exact reproduction of SummaryPage handleFinalize flow
  const handleFinalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;
    submitError = null;
    try {
      const payload = buildFinalizePayload({ receipt, people, assignments });
      await finalizeBill(payload);
      navigated = true;
    } catch (err) {
      isFinalizing = false;
      submitError = err.message || 'Failed to finalize bill. Please try again.';
    }
  };

  await handleFinalize();

  assert.equal(navigated, false, 'Did not navigate away on network failure');
  assert.equal(isFinalizing, false, 'isFinalizing reset back to false allowing retry');
  assert.equal(submitError, 'Network Error');
  // Verify state inputs remain completely unmodified
  assert.equal(receipt.items[0].name, 'Burger');
  assert.equal(people[0].name, 'Alice');
  assert.deepEqual(assignments, { i1: ['p1'] });
});

test('6. Open an invalid /b/... URL (malformed or nonexistent)', async () => {
  // 6a. Empty / whitespace share code throws 404 client-side
  await assert.rejects(
    () => getBill('   '),
    (err) => {
      assert.equal(err.status, 404);
      assert.equal(err.code, 'BILL_NOT_FOUND');
      assert.equal(err.message, 'Bill not found');
      return true;
    }
  );

  // 6b. Malformed or nonexistent code returned as 404 by server
  mock.method(axios, 'get', async () => {
    const err = new Error('Not found');
    err.response = {
      status: 404,
      data: { error: 'Bill not found.', code: 'BILL_NOT_FOUND' },
    };
    throw err;
  });

  await assert.rejects(
    () => getBill('invalid-code'),
    (err) => {
      assert.equal(err.status, 404);
      assert.equal(err.code, 'BILL_NOT_FOUND');
      assert.equal(err.message, 'Bill not found.');
      return true;
    }
  );
});

test('7. Test shared bill with slow / failed network (timeout and retry)', async () => {
  let attempt = 0;
  mock.method(axios, 'get', async () => {
    attempt++;
    if (attempt === 1) {
      const timeoutErr = new Error('timeout of 10000ms exceeded');
      timeoutErr.code = 'ECONNABORTED';
      throw timeoutErr;
    }
    return {
      data: {
        shareCode: 'JSdTY1ih',
        bill: {
          currency: 'USD',
          items: [{ id: '1', name: 'Pizza', priceMinor: 1500 }],
          totals: { billTotalMinor: 1500 },
        },
      },
    };
  });

  // 1st Attempt: Times out
  let error = null;
  let billData = null;
  try {
    billData = await getBill('JSdTY1ih');
  } catch (err) {
    error = err;
  }

  assert.equal(billData, null);
  assert.notEqual(error, null);
  assert.equal(error.code, 'TIMEOUT');
  assert.equal(error.message, 'Request timed out. Please try again.');

  // 2nd Attempt: User clicks "Try Again" on BillPage
  error = null;
  try {
    billData = await getBill('JSdTY1ih');
  } catch (err) {
    error = err;
  }

  assert.equal(error, null);
  assert.notEqual(billData, null);
  assert.equal(billData.shareCode, 'JSdTY1ih');
  assert.equal(attempt, 2);
});
