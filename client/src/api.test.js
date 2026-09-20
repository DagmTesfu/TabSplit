import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { extractReceipt } from './api.js';

afterEach(() => {
  mock.restoreAll();
});

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
