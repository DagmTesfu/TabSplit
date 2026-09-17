// Hermetic route tests for bill finalization and share lookup. The Supabase
// port is injected as a fake via setBillDbForTesting; no database, storage or
// external network access (a global fetch guard fails any accidental call).
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from './index.js';
import routerModule, { setBillDbForTesting } from './routes/bills.js';
import { getSupabaseClient } from './db.js';

const realFetch = globalThis.fetch;
const originalEnvironment = Object.fromEntries(
  ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_APP_URL'].map((key) => [key, process.env[key]])
);

beforeEach(() => {
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('External requests must be mocked in tests');
  });
});

afterEach(() => {
  mock.restoreAll();
  setBillDbForTesting(null);
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
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

const validBody = {
  restaurantName: 'Kaldi',
  currency: 'ETB',
  items: [
    { id: 'i1', name: 'Pizza', priceMinor: 60000, assignedTo: ['p1'] },
    { id: 'i2', name: 'Fries', priceMinor: 20000, assignedTo: ['p1', 'p2'] },
  ],
  people: [{ id: 'p1', name: 'Dagm' }, { id: 'p2', name: 'Abel' }],
  taxMinor: 1000,
  tipMinor: 500,
};

// Fake of the db port consumed through setBillDbForTesting.
function fakeDb(overrides = {}) {
  const rows = new Map();
  const state = { insertCalls: [], lookups: [] };
  return {
    state,
    rows,
    async insertBill(row) {
      if (overrides.insertError) return { data: null, error: overrides.insertError };
      if (rows.has(row.share_code)) return { data: null, error: { code: '23505' } };
      rows.set(row.share_code, { ...row, created_at: '2026-09-17T12:00:00.000Z' });
      state.insertCalls = (state.insertCalls ?? 0) + 1;
      return { data: { share_code: row.share_code }, error: null };
    },
    async findBillByCode(code) {
      state.lookups.push(code);
      if (overrides.findError) return { data: null, error: overrides.findError };
      const row = rows.get(code);
      if (!row) return { data: null, error: null };
      return {
        data: {
          share_code: row.share_code,
          created_at: row.created_at,
          restaurant_name: row.restaurant_name,
          currency: row.currency,
          bill: row.bill,
        },
        error: null,
      };
    },
  };
}

function post(base, body) {
  return realFetch(`${base}/api/bills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
}

test('db: getSupabaseClient returns null when credentials are missing', () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal(getSupabaseClient(), null);
});

test('route: POST /api/bills finalizes, persists and returns share URL', async () => {
  const fake = fakeDb();
  process.env.PUBLIC_APP_URL = 'https://tabsplit.example';
  await withServer(async (base) => {
    setBillDbForTesting(fake);
    const res = await post(base, validBody);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.shareCode, /^[1-9A-HJ-NP-Za-km-z]{8}$/);
    assert.equal(body.shareUrl, `https://tabsplit.example/b/${body.shareCode}`);
    // Server math: 60000 + 20000 (shared fries) + 1500 tax/tip = 81500.
    assert.equal(body.bill.totals.billTotalMinor, 81500);
    assert.deepEqual(body.bill.totals.people.map((person) => person.totalMinor), [71313, 10187]);
    const row = fake.rows.get(body.shareCode);
    assert.equal(row.total_minor, 81500);
    assert.equal(row.assigned_total_minor, 81500);
    assert.equal(row.unassigned_total_minor, 0);
    assert.equal(row.status, 'finalized');
    assert.deepEqual(row.bill, body.bill);
  });
});

test('route: POST /api/bills rejects invalid bills with 400 and stable codes', async () => {
  const fake = fakeDb();
  await withServer(async (base) => {
    setBillDbForTesting(fake);
    const cases = [
      [{ ...validBody, items: validBody.items.map((item) => ({ ...item, assignedTo: [] })) }, 'UNASSIGNED_ITEMS'],
      [{ ...validBody, currency: 'GBP' }, 'INVALID_CURRENCY'],
      [{ ...validBody, items: [{ ...validBody.items[0], priceMinor: -5 }] }, 'INVALID_BILL'],
      ['{broken json', 'INVALID_JSON'],
    ];
    for (const [body, expectedCode] of cases) {
      const res = await post(base, body);
      assert.equal(res.status, 400, expectedCode);
      assert.equal((await res.json()).code, expectedCode);
    }
    assert.deepEqual(fake.state.insertCalls, []);
  });
});

test('route: POST /api/bills returns 503 when database is unavailable', async () => {
  const fake = fakeDb({ insertError: { code: 'ECONNREFUSED', message: 'supabase down' } });
  await withServer(async (base) => {
    setBillDbForTesting(fake);
    const res = await post(base, validBody);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'DB_UNAVAILABLE');
  });
});

test('route: POST /api/bills retries duplicate share codes', async () => {
  const fake = fakeDb();
  const originalInsert = fake.insertBill.bind(fake);
  let calls = 0;
  fake.insertBill = async (row) => {
    calls += 1;
    if (calls === 1) return { data: null, error: { code: '23505' } }; // one collision
    return originalInsert(row);
  };
  await withServer(async (base) => {
    setBillDbForTesting(fake);
    const res = await post(base, validBody);
    assert.equal(res.status, 201);
    assert.equal(calls, 2);
  });
});

test('route: POST /api/bills returns 503 after repeated unique violations', async () => {
  const fake = fakeDb();
  fake.insertBill = async () => ({ data: null, error: { code: '23505' } });
  await withServer(async (base) => {
    setBillDbForTesting(fake);
    const res = await post(base, validBody);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'DB_UNAVAILABLE');
  });
});

test('route: GET /api/bills/:code returns the canonical bill', async () => {
  const fake = fakeDb();
  await withServer(async (base) => {
    setBillDbForTesting(fake);
    const created = await (await post(base, validBody)).json();
    const res = await realFetch(`${base}/api/bills/${created.shareCode}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.shareCode, created.shareCode);
    assert.equal(body.restaurantName, 'Kaldi');
    assert.equal(body.currency, 'ETB');
    assert.equal(body.bill.totals.billTotalMinor, 81500);
    assert.ok(body.createdAt);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });
});

test('route: GET 404s malformed codes before any database lookup', async () => {
  const fake = fakeDb();
  await withServer(async (base) => {
    setBillDbForTesting(fake);
    for (const code of ['0OIl2345', 'short', 'waytoolongcode123']) {
      const res = await realFetch(`${base}/api/bills/${code}`);
      assert.equal(res.status, 404);
      assert.equal((await res.json()).code, 'BILL_NOT_FOUND');
    }
    assert.equal(fake.state.lookups.length, 0);
  });
});

test('route: GET returns 404 for a well-formed but unknown code', async () => {
  const fake = fakeDb();
  await withServer(async (base) => {
    setBillDbForTesting(fake);
    const res = await realFetch(`${base}/api/bills/8Kx92LmQ`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, 'BILL_NOT_FOUND');
    assert.equal(fake.state.lookups.length, 1);
  });
});

test('route: GET /api/bills/:code maps database failures to 503', async () => {
  const fake = fakeDb({ findError: { message: 'connection refused' } });
  await withServer(async (base) => {
    setBillDbForTesting(fake);
    const res = await realFetch(`${base}/api/bills/8Kx92LmQ`);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'DB_UNAVAILABLE');
  });
});
