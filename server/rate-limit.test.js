import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from './index.js';
import { createRateLimiter, extractRateLimiter, billsRateLimiter, getClientIp } from './middleware/rateLimit.js';

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

test('Rate Limiter Middleware: getClientIp', () => {
  assert.equal(getClientIp({ ip: '192.168.1.1' }), '192.168.1.1');
  assert.equal(getClientIp({ socket: { remoteAddress: '10.0.0.1' } }), '10.0.0.1');
  assert.equal(getClientIp({}), '127.0.0.1');
});

test('Rate Limiter Middleware: permits requests under limit', () => {
  let now = 1000;
  const limiter = createRateLimiter({
    windowMs: 60000,
    maxRequests: 3,
    getTime: () => now,
  });

  let nextCount = 0;
  const req = { ip: '1.2.3.4' };
  const res = {};
  const next = () => { nextCount++; };

  limiter(req, res, next);
  limiter(req, res, next);
  limiter(req, res, next);

  assert.equal(nextCount, 3);
});

test('Rate Limiter Middleware: blocks requests exceeding limit with 429, Retry-After header and RATE_LIMITED code', () => {
  let now = 10000;
  const limiter = createRateLimiter({
    windowMs: 60000,
    maxRequests: 2,
    message: 'Too many requests.',
    getTime: () => now,
  });

  const req = { ip: '1.2.3.4' };
  let nextCount = 0;
  const next = () => { nextCount++; };

  limiter(req, {}, next); // 1
  limiter(req, {}, next); // 2
  assert.equal(nextCount, 2);

  let statusCalledWith = null;
  let jsonCalledWith = null;
  const headers = {};

  const res = {
    setHeader(k, v) { headers[k] = v; },
    status(s) {
      statusCalledWith = s;
      return {
        json(data) {
          jsonCalledWith = data;
        },
      };
    },
  };

  limiter(req, res, next); // 3 -> exceeded

  assert.equal(nextCount, 2); // next() was not called
  assert.equal(statusCalledWith, 429);
  assert.deepEqual(jsonCalledWith, {
    error: 'Too many requests.',
    code: 'RATE_LIMITED',
  });
  // window is 60s, reset is at now + 60s (70000), so retry-after is 60s
  assert.equal(headers['Retry-After'], '60');
  assert.equal(headers['Cache-Control'], 'no-store');
});

test('Rate Limiter Middleware: isolates limits across different IP addresses', () => {
  let now = 1000;
  const limiter = createRateLimiter({
    windowMs: 60000,
    maxRequests: 1,
    getTime: () => now,
  });

  let nextA = 0;
  let nextB = 0;

  limiter({ ip: '10.0.0.1' }, {}, () => { nextA++; });
  limiter({ ip: '10.0.0.2' }, {}, () => { nextB++; });

  assert.equal(nextA, 1);
  assert.equal(nextB, 1);
});

test('Rate Limiter Middleware: resets counter after windowMs expires', () => {
  let now = 1000;
  const limiter = createRateLimiter({
    windowMs: 60000,
    maxRequests: 1,
    getTime: () => now,
  });

  let nextCount = 0;
  const next = () => { nextCount++; };

  limiter({ ip: '1.2.3.4' }, {}, next);
  assert.equal(nextCount, 1);

  // Blocked before expiry
  let blocked = false;
  limiter({ ip: '1.2.3.4' }, {
    setHeader() {},
    status() { return { json() { blocked = true; } }; },
  }, next);
  assert.equal(blocked, true);

  // Advance time past window (60s = 60000ms)
  now += 60001;

  limiter({ ip: '1.2.3.4' }, {}, next);
  assert.equal(nextCount, 2);
});

test('Rate Limiter Middleware: evicts entries when maxEntries is reached to prevent unbounded memory growth', () => {
  let now = 1000;
  const limiter = createRateLimiter({
    windowMs: 10000,
    maxRequests: 5,
    maxEntries: 3,
    getTime: () => now,
  });

  limiter({ ip: 'ip-1' }, {}, () => {});
  limiter({ ip: 'ip-2' }, {}, () => {});
  limiter({ ip: 'ip-3' }, {}, () => {});
  assert.equal(limiter.store.size, 3);

  // Advance time so old entries expire
  now += 15000;
  limiter({ ip: 'ip-4' }, {}, () => {});

  // Old expired entries were cleaned up
  assert.ok(limiter.store.size <= 3);
  assert.ok(limiter.store.has('ip-4'));
});

test('Rate Limiter Middleware: reset() clears all tracked IP entries', () => {
  const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 5 });
  limiter({ ip: '1.1.1.1' }, {}, () => {});
  assert.equal(limiter.store.size, 1);
  limiter.reset();
  assert.equal(limiter.store.size, 0);
});

test('Integration: /api/health is NOT rate-limited', async () => {
  await withServer(async (base) => {
    for (let i = 0; i < 70; i++) {
      const res = await fetch(`${base}/api/health`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });
    }
  });
});

test('Integration: /api/extract-receipt rate limits at 10 requests / 15 min per IP', async () => {
  extractRateLimiter.reset();
  await withServer(async (base) => {
    // 10 invalid requests (no body) -> 400 Bad Request
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${base}/api/extract-receipt`, {
        method: 'POST',
      });
      assert.equal(res.status, 400);
    }

    // 11th request must be rejected with 429 Too Many Requests
    const blockedRes = await fetch(`${base}/api/extract-receipt`, {
      method: 'POST',
    });

    assert.equal(blockedRes.status, 429);
    assert.equal(blockedRes.headers.get('cache-control'), 'no-store');
    assert.ok(blockedRes.headers.get('retry-after'));
    const body = await blockedRes.json();
    assert.equal(body.code, 'RATE_LIMITED');
    assert.match(body.error, /receipt extraction/i);
  });
});

test('Integration: /api/bills rate limits after 60 requests per IP', async () => {
  billsRateLimiter.reset();
  await withServer(async (base) => {
    // 60 requests -> 400 Bad Request (empty JSON body)
    for (let i = 0; i < 60; i++) {
      const res = await fetch(`${base}/api/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
    }

    // 61st request must be 429
    const blockedRes = await fetch(`${base}/api/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(blockedRes.status, 429);
    assert.equal(blockedRes.headers.get('cache-control'), 'no-store');
    assert.ok(blockedRes.headers.get('retry-after'));
    const body = await blockedRes.json();
    assert.equal(body.code, 'RATE_LIMITED');
  });
});
