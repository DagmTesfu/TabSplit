// Unit validation plus real local HTTP tests; only external AI calls are mocked.
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from './index.js';
import { assertSupportedCurrency, detectImageType, normalizeReceiptData, AiError, extractReceipt, MAX_IMAGE_BYTES } from './ai.js';

const realFetch = globalThis.fetch;
const originalEnvironment = Object.fromEntries(
  ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'OPENAI_VISION_MODEL', 'PORT'].map((key) => [key, process.env[key]])
);
// Signatures exercise sniffing only, not image decoding or live OCR quality.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'latin1');
const TEXT = Buffer.from('not an image');
const receipt = { restaurantName: 'Kaldi', items: [{ name: 'Coffee', quantity: 1, price: '40.00' }] };
const normalized = {
  restaurantName: 'Kaldi',
  currency: 'ETB',
  items: [{ name: 'Coffee', quantity: 1, priceMinor: 4000 }],
  taxMinor: 0,
  taxInclusive: false,
  tipMinor: 0,
  additionalCharges: [],
  printedTotalMinor: null,
  totalMinor: 4000,
};

beforeEach(() => {
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('External requests must be mocked in tests');
  });
});

// Cleanup runs even if assertions fail, without deleting a developer's real key.
afterEach(() => {
  mock.restoreAll();
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function fakeReply(content, finish_reason = 'stop') {
  return { choices: [{ finish_reason, message: { content } }] };
}

function provider(reply = fakeReply(JSON.stringify(receipt))) {
  process.env.OPENROUTER_API_KEY = 'test-only-key';
  return mock.method(globalThis, 'fetch', async (url, options) => {
    // Never intercept the local HTTP client: these tests must reach Express.
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    // Surface the outgoing prompt so tests can assert currency propagation.
    lastPrompt = JSON.parse(options.body).messages[0].content;
    return { ok: true, status: 200, text: async () => JSON.stringify(reply) };
  });
}
let lastPrompt = '';

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

function uploadForm({ type = 'image/jpeg', bytes = JPEG, field = 'image', currency } = {}) {
  const form = new FormData();
  if (currency !== null) form.append('currency', currency ?? 'ETB');
  form.append(field, new Blob([bytes], { type }), 'receipt.jpg');
  return form;
}

function post(base, body = uploadForm()) {
  return realFetch(`${base}/api/extract-receipt`, {
    method: 'POST', body, signal: AbortSignal.timeout(5000),
  });
}

test('signatures: JPEG, PNG, WebP supported; HEIC and non-images rejected', () => {
  assert.equal(detectImageType(JPEG), 'image/jpeg');
  assert.equal(detectImageType(PNG), 'image/png');
  assert.equal(detectImageType(WEBP), 'image/webp');
  for (const bytes of [TEXT, Buffer.alloc(0), Buffer.from('0000ftypheic'), 'text']) {
    assert.equal(detectImageType(bytes), null);
  }
});

test('currency: ETB and USD supported, missing/unsupported rejected with stable code', () => {
  assert.deepEqual(assertSupportedCurrency('ETB'), { code: 'ETB', minorUnits: 2 });
  assert.deepEqual(assertSupportedCurrency('usd'), { code: 'USD', minorUnits: 2 });
  assert.deepEqual(assertSupportedCurrency(' USD '), { code: 'USD', minorUnits: 2 });
  for (const bad of [undefined, null, '', '  ', 'us', 'USDT', 'eur', 'EUR', 'GBP', 840, {}, ['USD']]) {
    assert.throws(() => assertSupportedCurrency(bad), (error) => error instanceof AiError && error.code === 'INVALID_CURRENCY');
  }
});

test('currency: lowercase and padded input are normalized, never trusted verbatim', () => {
  assert.equal(normalizeReceiptData(receipt, 'usd').currency, 'USD');
  assert.equal(normalizeReceiptData(receipt, ' etb ').currency, 'ETB');
});

test('normalization: trimmed names, currency echo, and exact minor units', () => {
  assert.deepEqual(
    normalizeReceiptData({ restaurantName: ' R ', items: [
      { name: ' CEVICHE ', price: 16.95 }, { name: 'Drink', price: '1,234.50' },
      { name: 'Water', price: 0 }, { name: 'Small', price: '.29' },
    ] }, 'USD'),
    { restaurantName: 'R', currency: 'USD', items: [
      { name: 'CEVICHE', quantity: 1, priceMinor: 1695 }, { name: 'Drink', quantity: 1, priceMinor: 123450 },
      { name: 'Water', quantity: 1, priceMinor: 0 }, { name: 'Small', quantity: 1, priceMinor: 29 },
    ], taxMinor: 0, taxInclusive: false, tipMinor: 0, additionalCharges: [], printedTotalMinor: null, totalMinor: 125174 });
  assert.equal(normalizeReceiptData({ items: receipt.items }, 'ETB').restaurantName, '');
  assert.equal(normalizeReceiptData({ items: [{ name: 'Big', price: '90071992547409.91' }] }, 'ETB').items[0].priceMinor, Number.MAX_SAFE_INTEGER);
});

test('normalization: quantity defaults to 1 and preserves quantity > 1', () => {
  const result = normalizeReceiptData({
    items: [
      { name: 'ULSD Sugar Free', quantity: 2, price: '8.20' },
      { name: 'Midweek Carvery', price: '10.79' },
    ],
  }, 'USD');
  assert.equal(result.items[0].quantity, 2);
  assert.equal(result.items[0].priceMinor, 820);
  assert.equal(result.items[1].quantity, 1);
  assert.equal(result.items[1].priceMinor, 1079);
});

test('normalization: invalid quantity rejects with INVALID_RESPONSE', () => {
  for (const quantity of [0, -1, 1.5, '2', null, {}, []]) {
    assert.throws(
      () => normalizeReceiptData({ items: [{ name: 'Drink', quantity, price: '4.00' }] }, 'USD'),
      (error) => error instanceof AiError && error.code === 'INVALID_RESPONSE'
    );
  }
});

test('normalization: signed negative line prices are converted to negative priceMinor', () => {
  const result = normalizeReceiptData({
    items: [
      { name: 'Pizza', price: '15.00' },
      { name: 'Discount Voucher', price: '-5.00' },
    ],
  }, 'USD');
  assert.equal(result.items[0].priceMinor, 1500);
  assert.equal(result.items[1].priceMinor, -500);
  assert.equal(result.totalMinor, 1000); // 1500 - 500
});

test('normalization: tax-exclusive reconciliation with printedTotal', () => {
  const result = normalizeReceiptData({
    restaurantName: 'El Chalan Restaurant',
    items: [
      { name: 'CAUSA DE POLLO', price: '8.95' },
      { name: 'CEVICHE DE CAMARONES', price: '16.95' },
      { name: 'LIMONADA', price: '4.00' },
      { name: 'PESCADO AL AJILLO', price: '15.95' },
    ],
    tax: '3.67',
    printedTotal: '49.52',
  }, 'USD');
  assert.equal(result.taxMinor, 367);
  assert.equal(result.taxInclusive, false);
  assert.equal(result.printedTotalMinor, 4952);
  assert.equal(result.totalMinor, 4952);
});

test('normalization: tax-inclusive reconciliation with printedTotal (Toby Carvery pattern)', () => {
  const result = normalizeReceiptData({
    restaurantName: 'Toby Carvery',
    items: [
      { name: 'ULSD Sugar Free', quantity: 2, price: '8.20' },
      { name: 'Chd MW Carvery', quantity: 1, price: '6.99' },
      { name: 'Midweek Carvery', quantity: 1, price: '10.79' },
      { name: 'Childs Ice Cream', quantity: 1, price: '2.00' },
      { name: 'Rewards Card', quantity: 1, price: '0.00' },
      { name: 'TBY KEF£1', quantity: 1, price: '0.00' },
      { name: 'TBY KEF£1 1P', price: '-5.99' },
    ],
    tax: '3.67',
    printedTotal: '21.99',
  }, 'USD');
  assert.equal(result.taxMinor, 367);
  assert.equal(result.taxInclusive, true);
  assert.equal(result.printedTotalMinor, 2199);
  assert.equal(result.totalMinor, 2199); // 2199, NOT 2566
});

test('normalization: reconciliation mismatch throws INVALID_RESPONSE', () => {
  assert.throws(
    () => normalizeReceiptData({
      items: [{ name: 'Pizza', price: '10.00' }],
      tax: '1.00',
      printedTotal: '50.00', // neither 10.00 nor 11.00 matches 50.00
    }, 'USD'),
    (error) => error instanceof AiError && error.code === 'INVALID_RESPONSE'
  );
});

test('normalization: rejects invalid structure, names, unknown fields and missing prices', () => {
  const invalid = [null, [], 'text', {}, { items: [] }, { items: 'text' },
    { ...receipt, restaurantName: 42 }, { ...receipt, restaurantName: 'x'.repeat(121) },
    { ...receipt, currency: 'USD' }, { ...receipt, total: 10 }, { items: [null] }, { items: ['Pizza'] },
    { items: [{ name: '', price: 1 }] }, { items: [{ name: ' ', price: 1 }] },
    { items: [{ name: 12, price: 1 }] }, { items: [{ name: 'x'.repeat(121), price: 1 }] },
    { items: [{ name: 'x\u0000y', price: 1 }] }, { items: [{ price: 1 }] },
    { items: [{ name: 'Pizza' }] }, { items: [{ name: 'Pizza', priceMinor: 10 }] },
    { items: [{ name: 'Pizza', price: 10, confidence: 1 }] },
    { items: new Array(1) },
  ];
  for (const data of invalid) assert.throws(() => normalizeReceiptData(data, 'ETB'), AiError);
});

test('normalization: rejects fractional minor units, bad separators and overflow', () => {
  for (const price of [1.234, '1.234', '12,50', '1,,000', '1 00', '1,23,456',
    NaN, Infinity, null, undefined, {}, [], true, '', 'abc', '1e2', '90071992547409.92']) {
    assert.throws(() => normalizeReceiptData({ items: [{ name: 'Pizza', price }] }),
      (error) => error instanceof AiError && error.code === 'INVALID_RESPONSE');
  }
});

test('normalization: item count capped and input is not mutated', () => {
  const item = Object.freeze({ name: ' X ', price: '1.00' });
  const data = Object.freeze({ items: Object.freeze([item]) });
  assert.equal(normalizeReceiptData(data, 'ETB').items[0].name, 'X');
  assert.equal(item.name, ' X ');
  assert.equal(normalizeReceiptData({ items: Array(100).fill(item) }, 'ETB').items.length, 100);
  assert.throws(() => normalizeReceiptData({ items: Array(101).fill(item) }, 'ETB'), /Too many/);
});

test('normalization: no adjustments → taxMinor=0, tipMinor=0, additionalCharges=[], totalMinor=itemsSum', () => {
  const result = normalizeReceiptData(receipt, 'ETB');
  assert.equal(result.taxMinor, 0);
  assert.equal(result.taxInclusive, false);
  assert.equal(result.tipMinor, 0);
  assert.deepEqual(result.additionalCharges, []);
  assert.equal(result.printedTotalMinor, null);
  assert.equal(result.totalMinor, 4000);
});

test('normalization: printed tax is converted and included in totalMinor', () => {
  const result = normalizeReceiptData({ items: [{ name: 'Burger', price: '10.00' }], tax: '1.50' }, 'USD');
  assert.equal(result.taxMinor, 150);
  assert.equal(result.taxInclusive, false);
  assert.equal(result.tipMinor, 0);
  assert.deepEqual(result.additionalCharges, []);
  assert.equal(result.totalMinor, 1150); // 1000 + 150
});

test('normalization: printed tip is converted and included in totalMinor', () => {
  const result = normalizeReceiptData({ items: [{ name: 'Pasta', price: '20.00' }], tip: '3.00' }, 'USD');
  assert.equal(result.taxMinor, 0);
  assert.equal(result.taxInclusive, false);
  assert.equal(result.tipMinor, 300);
  assert.equal(result.totalMinor, 2300); // 2000 + 300
});

test('normalization: tax + tip + items add up correctly in totalMinor', () => {
  const result = normalizeReceiptData({
    restaurantName: 'Trattoria',
    items: [{ name: 'Pizza', price: '15.00' }, { name: 'Salad', price: '8.00' }],
    tax: '2.30',
    tip: '4.60',
  }, 'USD');
  assert.equal(result.taxMinor, 230);
  assert.equal(result.taxInclusive, false);
  assert.equal(result.tipMinor, 460);
  assert.equal(result.totalMinor, 2990);
});

test('normalization: additionalCharges with service charge', () => {
  const result = normalizeReceiptData({
    items: [{ name: 'Coffee', price: '40.00' }],
    additionalCharges: [{ name: 'Service Charge', amount: '8.00' }],
  }, 'ETB');
  assert.equal(result.additionalCharges.length, 1);
  assert.equal(result.additionalCharges[0].name, 'Service Charge');
  assert.equal(result.additionalCharges[0].amountMinor, 800);
  assert.equal(result.totalMinor, 4800); // 4000 + 800
});

test('normalization: multiple additionalCharges all included in totalMinor', () => {
  const result = normalizeReceiptData({
    items: [{ name: 'Tea', price: '25.00' }],
    tax: '2.50',
    additionalCharges: [
      { name: 'Service Charge', amount: '5.00' },
      { name: 'Delivery Fee', amount: '10.00' },
    ],
  }, 'ETB');
  assert.equal(result.taxMinor, 250);
  assert.equal(result.additionalCharges[0].amountMinor, 500);
  assert.equal(result.additionalCharges[1].amountMinor, 1000);
  assert.equal(result.totalMinor, 4250); // 2500 + 250 + 500 + 1000 = 4250
});

test('normalization: additionalCharges name is trimmed', () => {
  const result = normalizeReceiptData({
    items: [{ name: 'Juice', price: '5.00' }],
    additionalCharges: [{ name: '  VAT  ', amount: '0.75' }],
  }, 'USD');
  assert.equal(result.additionalCharges[0].name, 'VAT');
});

test('normalization: malformed tax amount rejects with INVALID_RESPONSE', () => {
  for (const tax of [-1, '-1', 'abc', null, {}, [], true, '1e2', '1.234']) {
    assert.throws(
      () => normalizeReceiptData({ items: [{ name: 'Pizza', price: '10.00' }], tax }, 'ETB'),
      (error) => error instanceof AiError && error.code === 'INVALID_RESPONSE'
    );
  }
});

test('normalization: malformed tip amount rejects with INVALID_RESPONSE', () => {
  for (const tip of [-1, 'abc', null, {}, NaN]) {
    assert.throws(
      () => normalizeReceiptData({ items: [{ name: 'Pizza', price: '10.00' }], tip }, 'ETB'),
      (error) => error instanceof AiError && error.code === 'INVALID_RESPONSE'
    );
  }
});

test('normalization: additionalCharges with missing or bad name/amount rejects', () => {
  const item = { name: 'Pizza', price: '10.00' };
  const invalid = [
    null,
    'string',
    { name: '', amount: '5.00' },
    { name: '  ', amount: '5.00' },
    { name: 'VAT' }, // missing amount
    { name: 'VAT', amount: '-1' },
    { name: 'VAT', amount: 'abc' },
    { name: 'VAT', amount: '5.00', extra: true }, // unexpected field
  ];
  for (const charge of invalid) {
    assert.throws(
      () => normalizeReceiptData({ items: [item], additionalCharges: [charge] }, 'ETB'),
      (error) => error instanceof AiError && error.code === 'INVALID_RESPONSE'
    );
  }
});

test('normalization: additionalCharges must be an array; non-array rejects', () => {
  for (const additionalCharges of [{}, 'string', 42, true, null]) {
    assert.throws(
      () => normalizeReceiptData({ items: [{ name: 'Pizza', price: '10.00' }], additionalCharges }, 'ETB'),
      (error) => error instanceof AiError && error.code === 'INVALID_RESPONSE'
    );
  }
});

test('normalization: top-level "total" field is rejected (AI must not return a total)', () => {
  assert.throws(
    () => normalizeReceiptData({ items: [{ name: 'Pizza', price: '10.00' }], total: '10.00' }, 'ETB'),
    (error) => error instanceof AiError && error.code === 'INVALID_RESPONSE'
  );
});

test('extraction: image validation runs before external calls', async () => {
  const mocked = provider();
  await assert.rejects(() => extractReceipt(TEXT, 'image/png', 'USD'), /corrupted/);
  await assert.rejects(() => extractReceipt(JPEG, 'image/png', 'USD'), /do not match/);
  await assert.rejects(() => extractReceipt(Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image/jpeg', 'USD'), /too large/);
  assert.equal(mocked.mock.callCount(), 0);
});

test('extraction: missing credentials produce NOT_CONFIGURED', async () => {
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(() => extractReceipt(JPEG, 'image/jpeg', 'USD'), { code: 'NOT_CONFIGURED' });
});

test('extraction: invalid currency is rejected before any image or provider work', async () => {
  const mocked = provider();
  await assert.rejects(() => extractReceipt(JPEG, 'image/jpeg', 'EUR'), { code: 'INVALID_CURRENCY' });
  await assert.rejects(() => extractReceipt(JPEG, 'image/jpeg', ''), { code: 'INVALID_CURRENCY' });
  await assert.rejects(() => extractReceipt(JPEG, 'image/jpeg', undefined), { code: 'INVALID_CURRENCY' });
  assert.equal(mocked.mock.callCount(), 0);
});

test('extraction: provider receives validated bytes and returns normalized JSON', async () => {
  const mocked = provider();
  assert.deepEqual(await extractReceipt(JPEG, 'image/jpeg', 'ETB'), normalized);
  const options = mocked.mock.calls[0].arguments[1];
  const body = JSON.parse(options.body);
  assert.equal(options.headers.Authorization, 'Bearer test-only-key');
  // OpenRouter free-model router with OpenAI-compatible chat completions.
  assert.equal(body.model, 'openrouter/free');
  assert.equal(body.store, false);
  assert.equal(body.messages[1].content[0].image_url.url, `data:image/jpeg;base64,${JPEG.toString('base64')}`);
  assert.ok(options.signal instanceof AbortSignal);
});

test('extraction: user-selected currency is injected into the provider prompt', async () => {
  for (const currency of ['USD', 'ETB']) {
    const mocked = provider(fakeReply(JSON.stringify({ restaurantName: 'R', items: [{ name: 'X', price: '1.00' }] })));
    await extractReceipt(JPEG, 'image/jpeg', currency);
    mocked.mock.restore();
    assert.match(lastPrompt, /already been selected by the user: (USD|ETB)/);
    assert.match(lastPrompt, /Do not detect, infer, convert, or change the currency/);
    assert.match(lastPrompt, /Do not estimate missing digits/);
  }
});

test('extraction: refuses fenced JSON, prose, arrays, truncation and invalid content types', async () => {
  const text = JSON.stringify(receipt);
  const replies = [fakeReply('```json\n' + text + '\n```'), fakeReply('Result: ' + text),
    fakeReply('[' + text + ']'), fakeReply(text, 'length'), fakeReply({}), fakeReply(null),
    fakeReply('not JSON'), fakeReply('x'.repeat(64001)), {},
    { choices: [{ finish_reason: 'stop', message: { content: text, refusal: 'Cannot comply' } }] },
  ];
  for (const reply of replies) {
    const mocked = provider(reply);
    await assert.rejects(() => extractReceipt(JPEG, 'image/jpeg', 'ETB'), { code: 'INVALID_RESPONSE' });
    mocked.mock.restore();
  }
});

test('retry: succeeds on 2nd attempt after transient PROVIDER_ERROR', async () => {
  process.env.OPENROUTER_API_KEY = 'test-only-key';
  let callCount = 0;
  const mocked = mock.method(globalThis, 'fetch', async () => {
    callCount++;
    if (callCount === 1) {
      return { ok: false, status: 502, text: async () => 'temporary provider error' };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(fakeReply(JSON.stringify(receipt))) };
  });
  const result = await extractReceipt(JPEG, 'image/jpeg', 'ETB');
  assert.deepEqual(result, normalized);
  assert.equal(callCount, 2);
  mocked.mock.restore();
});

test('retry: succeeds on 2nd attempt after transient malformed JSON / INVALID_RESPONSE', async () => {
  process.env.OPENROUTER_API_KEY = 'test-only-key';
  let callCount = 0;
  const mocked = mock.method(globalThis, 'fetch', async () => {
    callCount++;
    if (callCount === 1) {
      return { ok: true, status: 200, text: async () => JSON.stringify(fakeReply('malformed non-json')) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(fakeReply(JSON.stringify(receipt))) };
  });
  const result = await extractReceipt(JPEG, 'image/jpeg', 'ETB');
  assert.deepEqual(result, normalized);
  assert.equal(callCount, 2);
  mocked.mock.restore();
});

test('retry: succeeds on 2nd attempt after transient invalid schema from model', async () => {
  process.env.OPENROUTER_API_KEY = 'test-only-key';
  let callCount = 0;
  const mocked = mock.method(globalThis, 'fetch', async () => {
    callCount++;
    if (callCount === 1) {
      return { ok: true, status: 200, text: async () => JSON.stringify(fakeReply(JSON.stringify({ items: [] }))) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(fakeReply(JSON.stringify(receipt))) };
  });
  const result = await extractReceipt(JPEG, 'image/jpeg', 'ETB');
  assert.deepEqual(result, normalized);
  assert.equal(callCount, 2);
  mocked.mock.restore();
});

test('retry: stops at maximum 2 attempts on persistent failure', async () => {
  process.env.OPENROUTER_API_KEY = 'test-only-key';
  let callCount = 0;
  const mocked = mock.method(globalThis, 'fetch', async () => {
    callCount++;
    return { ok: true, status: 200, text: async () => JSON.stringify(fakeReply('not json')) };
  });
  await assert.rejects(() => extractReceipt(JPEG, 'image/jpeg', 'ETB'), { code: 'INVALID_RESPONSE' });
  assert.equal(callCount, 2);
  mocked.mock.restore();
});

test('route: health and unknown paths remain unchanged', async () => {
  await withServer(async (base) => {
    assert.deepEqual(await (await realFetch(`${base}/api/health`)).json(), { ok: true });
    assert.equal((await realFetch(`${base}/api/nope`)).status, 404);
  });
});

test('route: rejects invalid MIME, spoofed content, wrong fields and missing images', async () => {
  const mocked = provider();
  await withServer(async (base) => {
    for (const [form, code] of [
      [uploadForm({ type: 'application/pdf', bytes: TEXT }), 'INVALID_UPLOAD'],
      [uploadForm({ type: 'image/heic', bytes: TEXT }), 'INVALID_UPLOAD'],
      [uploadForm({ type: 'image/png', bytes: TEXT }), 'INVALID_IMAGE'],
      [uploadForm({ type: 'image/png', bytes: JPEG }), 'INVALID_IMAGE'],
      [uploadForm({ type: 'image/jpeg', bytes: JPEG, field: 'wrong' }), 'INVALID_UPLOAD'],
      [new FormData(), 'NO_FILE'],
    ]) {
      const res = await post(base, form);
      assert.equal(res.status, 400);
      assert.equal((await res.json()).code, code);
    }
  });
  assert.equal(mocked.mock.callCount(), 0);
});

test('route: enforces size limit and rejects multiple files or extra fields', async () => {
  const mocked = provider();
  await withServer(async (base) => {
    const big = await post(base, uploadForm({ bytes: Buffer.alloc(MAX_IMAGE_BYTES + 1) }));
    assert.equal(big.status, 413);
    assert.equal((await big.json()).code, 'IMAGE_TOO_LARGE');
    const two = uploadForm();
    two.append('image', new Blob([JPEG], { type: 'image/jpeg' }), 'second.jpg');
    assert.equal((await post(base, two)).status, 400);
    const extra = uploadForm();
    extra.append('extra', 'value');
    assert.equal((await post(base, extra)).status, 400);
  });
  assert.equal(mocked.mock.callCount(), 0);
});

test('route: malformed multipart returns a useful 400 error', async () => {
  await withServer(async (base) => {
    const res = await realFetch(`${base}/api/extract-receipt`, {
      method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, body: 'broken',
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'INVALID_UPLOAD');
  });
});

test('route: missing configuration returns 503', async () => {
  delete process.env.OPENROUTER_API_KEY;
  await withServer(async (base) => {
    const res = await post(base);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'NOT_CONFIGURED');
  });
});

test('route: complete multipart to mocked AI to normalized response', async () => {
  const mocked = provider();
  await withServer(async (base) => {
    const res = await post(base, uploadForm({ currency: 'ETB' }));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), normalized);
  });
  assert.equal(mocked.mock.callCount(), 1);
});

test('route: USD request echoes server-validated currency and minor units', async () => {
  provider(fakeReply(JSON.stringify({ restaurantName: 'Kaldi', items: [{ name: 'Coffee', price: '4.00' }] })));
  await withServer(async (base) => {
    const res = await post(base, uploadForm({ currency: 'usd' }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      restaurantName: 'Kaldi',
      currency: 'USD',
      items: [{ name: 'Coffee', quantity: 1, priceMinor: 400 }],
      taxMinor: 0,
      taxInclusive: false,
      tipMinor: 0,
      additionalCharges: [],
      printedTotalMinor: null,
      totalMinor: 400,
    });
  });
});

test('route: unsupported and missing currency rejected before any provider call', async () => {
  const mocked = provider();
  await withServer(async (base) => {
    for (const form of [uploadForm({ currency: 'EUR' }), uploadForm({ currency: 'usdt' }), uploadForm({ currency: null })]) {
      const res = await post(base, form);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.code, 'INVALID_CURRENCY');
      assert.match(body.error, /supported currency/i);
    }
  });
  assert.equal(mocked.mock.callCount(), 0);
});

test('route: provider decimal price converts exactly, including the $16.95 example', async () => {
  provider(fakeReply(JSON.stringify({ restaurantName: 'La Mar', items: [{ name: 'CEVICHE DE CAMARONES', price: '16.95' }] })));
  await withServer(async (base) => {
    const res = await post(base, uploadForm({ currency: 'USD' }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      restaurantName: 'La Mar',
      currency: 'USD',
      items: [{ name: 'CEVICHE DE CAMARONES', quantity: 1, priceMinor: 1695 }],
      taxMinor: 0,
      taxInclusive: false,
      tipMinor: 0,
      additionalCharges: [],
      printedTotalMinor: null,
      totalMinor: 1695,
    });
  });
});

test('route: invalid AI prices reject the entire extraction with 422', async () => {
  provider(fakeReply(JSON.stringify({ items: [{ name: 'Good', price: 10 }, { name: 'Bad', price: 'not-a-number' }] })));
  await withServer(async (base) => {
    const res = await post(base);
    assert.equal(res.status, 422);
    assert.equal((await res.json()).code, 'INVALID_RESPONSE');
  });
});

test('route: provider failures are sanitized and timeouts map to 504', async () => {
  process.env.OPENROUTER_API_KEY = 'test-only-key';
  const cases = [
    [async () => ({ ok: false, status: 401, text: async () => 'sensitive-provider-detail' }), 502, 'PROVIDER_ERROR'],
    [async () => { throw new Error('sensitive-provider-detail'); }, 502, 'PROVIDER_ERROR'],
    [async () => { throw new DOMException('sensitive-provider-detail', 'TimeoutError'); }, 504, 'PROVIDER_TIMEOUT'],
    [async () => ({ ok: true, status: 200, text: async () => 'sensitive-provider-detail' }), 502, 'PROVIDER_ERROR'],
  ];
  for (const [handler, status, code] of cases) {
    const mocked = mock.method(globalThis, 'fetch', handler);
    await withServer(async (base) => {
      const res = await post(base);
      assert.equal(res.status, status);
      const body = await res.json();
      assert.equal(body.code, code);
      assert.doesNotMatch(JSON.stringify(body), /sensitive-provider-detail|test-only-key/);
    });
    mocked.mock.restore();
  }
});
