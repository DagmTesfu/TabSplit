import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from './index.js';
import { setBillDbForTesting } from './routes/bills.js';
import { extractRateLimiter } from './middleware/rateLimit.js';

const realFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'secret-test-key-12345';
  process.env.SUPABASE_URL = 'https://secret-project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-service-role-key-99999';
  extractRateLimiter.reset();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  setBillDbForTesting(null);
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

async function withServer(run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('Security Audit: Database errors do not expose raw database details or stack traces', async () => {
  const sensitivePostgresError = {
    code: '42P01',
    message: 'relation "bills" does not exist in schema "public" at postgresql://postgres:supersecretpassword@db.supabase.co:5432/postgres',
    details: 'table bills missing',
    hint: 'create table bills',
  };

  setBillDbForTesting({
    insertBill: async () => ({ data: null, error: sensitivePostgresError }),
    findBillByCode: async () => ({ data: null, error: sensitivePostgresError }),
  });

  await withServer(async (base) => {
    // 1. POST /api/bills failure
    const postRes = await fetch(`${base}/api/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'USD',
        items: [{ id: 'i1', name: 'Item', priceMinor: 100, assignedTo: ['p1'] }],
        people: [{ id: 'p1', name: 'Dagm' }],
      }),
    });

    assert.equal(postRes.status, 503);
    const postBody = await postRes.json();
    assert.deepEqual(postBody, {
      error: 'Could not save the bill. Please try again.',
      code: 'DB_UNAVAILABLE',
    });
    // Verify no sensitive connection strings or postgres error messages leaked
    assert.doesNotMatch(JSON.stringify(postBody), /postgres|password|schema|table/i);
    assert.equal(postBody.stack, undefined);

    // 2. GET /api/bills/:code failure
    const getRes = await fetch(`${base}/api/bills/8Kx92LmQ`);
    assert.equal(getRes.status, 503);
    const getBody = await getRes.json();
    assert.deepEqual(getBody, {
      error: 'Could not save the bill. Please try again.',
      code: 'DB_UNAVAILABLE',
    });
    assert.doesNotMatch(JSON.stringify(getBody), /postgres|password|schema|table/i);
    assert.equal(getBody.stack, undefined);
  });
});

test('Security Audit: Provider errors do not expose API keys or raw provider response bodies', async () => {
  const sensitiveProviderHtml = '<html><head><title>502 Bad Gateway</title></head><body>Raw cloudflare payload secret-token-xyz</body></html>';
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (typeof url === 'string' && url.includes('openrouter.ai')) {
      return {
        ok: false,
        status: 502,
        text: async () => sensitiveProviderHtml,
        body: { cancel: async () => {} },
      };
    }
    return realFetch(url, options);
  });

  const form = new FormData();
  form.append('currency', 'USD');
  form.append('image', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], { type: 'image/jpeg' }), 'receipt.jpg');

  await withServer(async (base) => {
    const res = await realFetch(`${base}/api/extract-receipt`, {
      method: 'POST',
      body: form,
    });

    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.code, 'PROVIDER_ERROR');
    assert.doesNotMatch(JSON.stringify(body), /secret-test-key-12345|cloudflare|secret-token-xyz|<html>/i);
    assert.equal(body.stack, undefined);
  });
});

test('Security Audit: API keys and credentials are not present anywhere in client responses', async () => {
  await withServer(async (base) => {
    const healthRes = await fetch(`${base}/api/health`);
    const healthText = await healthRes.text();
    assert.doesNotMatch(healthText, /secret-test-key-12345|secret-service-role-key-99999/);

    const notFoundRes = await fetch(`${base}/api/nonexistent-route`);
    const notFoundText = await notFoundRes.text();
    assert.doesNotMatch(notFoundText, /secret-test-key-12345|secret-service-role-key-99999/);
    assert.equal(notFoundRes.status, 404);
  });
});

test('Security Audit: Stack traces are never returned on invalid JSON or unhandled 500s', async () => {
  await withServer(async (base) => {
    // Malformed JSON body
    const jsonRes = await fetch(`${base}/api/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ malformed json,',
    });
    assert.equal(jsonRes.status, 400);
    const jsonBody = await jsonRes.json();
    assert.equal(jsonBody.code, 'INVALID_JSON');
    assert.equal(jsonBody.stack, undefined);
    assert.doesNotMatch(JSON.stringify(jsonBody), /SyntaxError|at /);
  });
});

test('Security Audit: Rate-limit 429 response contains safe headers and no internal storage dump', async () => {
  await withServer(async (base) => {
    for (let i = 0; i < 10; i++) {
      await fetch(`${base}/api/extract-receipt`, { method: 'POST' });
    }
    const blockedRes = await fetch(`${base}/api/extract-receipt`, { method: 'POST' });
    assert.equal(blockedRes.status, 429);
    assert.ok(blockedRes.headers.get('retry-after'));
    assert.equal(blockedRes.headers.get('cache-control'), 'no-store');
    const body = await blockedRes.json();
    assert.equal(body.code, 'RATE_LIMITED');
    assert.equal(body.stack, undefined);
    assert.doesNotMatch(JSON.stringify(body), /127\.0\.0\.1|store|Map|size/);
  });
});
