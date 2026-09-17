// Unit validation plus real local HTTP tests; only external AI calls are mocked.
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from './index.js';
import { detectImageType, normalizeReceiptData, AiError, extractReceipt, MAX_IMAGE_BYTES } from './ai.js';

const realFetch = globalThis.fetch;
const originalEnvironment = Object.fromEntries(
  ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'OPENAI_VISION_MODEL'].map((key) => [key, process.env[key]])
);
// Signatures exercise sniffing only, not image decoding or live OCR quality.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'latin1');
const TEXT = Buffer.from('not an image');
const receipt = { restaurantName: 'Kaldi', items: [{ name: 'Coffee', price: '40.00' }] };
const normalized = { restaurantName: 'Kaldi', items: [{ name: 'Coffee', priceCents: 4000 }] };

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
  return mock.method(globalThis, 'fetch', async (url) => {
    // Never intercept the local HTTP client: these tests must reach Express.
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    return { ok: true, status: 200, text: async () => JSON.stringify(reply) };
  });
}

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

function uploadForm(type = 'image/jpeg', bytes = JPEG, field = 'image') {
  const form = new FormData();
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

test('normalization: trimmed names and exact integer cents, including zero', () => {
  assert.deepEqual(normalizeReceiptData({ restaurantName: ' R ', items: [
    { name: ' Pizza ', price: 600 }, { name: 'Drink', price: '1,234.50' },
    { name: 'Water', price: 0 }, { name: 'Small', price: '.29' },
  ] }), { restaurantName: 'R', items: [
    { name: 'Pizza', priceCents: 60000 }, { name: 'Drink', priceCents: 123450 },
    { name: 'Water', priceCents: 0 }, { name: 'Small', priceCents: 29 },
  ] });
  assert.equal(normalizeReceiptData({ items: receipt.items }).restaurantName, '');
  assert.equal(normalizeReceiptData({ items: [{ name: 'Big', price: '90071992547409.91' }] }).items[0].priceCents, Number.MAX_SAFE_INTEGER);
});

test('normalization: rejects invalid structure, names, unknown fields and missing prices', () => {
  const invalid = [null, [], 'text', {}, { items: [] }, { items: 'text' },
    { ...receipt, restaurantName: 42 }, { ...receipt, restaurantName: 'x'.repeat(121) },
    { ...receipt, total: 10 }, { items: [null] }, { items: ['Pizza'] },
    { items: [{ name: '', price: 1 }] }, { items: [{ name: ' ', price: 1 }] },
    { items: [{ name: 12, price: 1 }] }, { items: [{ name: 'x'.repeat(121), price: 1 }] },
    { items: [{ name: 'x\u0000y', price: 1 }] }, { items: [{ price: 1 }] },
    { items: [{ name: 'Pizza' }] }, { items: [{ name: 'Pizza', priceCents: 10 }] },
    { items: [{ name: 'Pizza', price: 10, confidence: 1 }] },
    { items: new Array(1) },
  ];
  for (const data of invalid) assert.throws(() => normalizeReceiptData(data), AiError);
});

test('normalization: rejects negatives, fractional cents, bad separators and overflow', () => {
  for (const price of [-1, '-1', 1.234, '1.234', '12,50', '1,,000', '1 00', '1,23,456',
    NaN, Infinity, null, undefined, {}, [], true, '', 'abc', '1e2', '90071992547409.92']) {
    assert.throws(() => normalizeReceiptData({ items: [{ name: 'Pizza', price }] }),
      (error) => error instanceof AiError && error.code === 'INVALID_RESPONSE');
  }
});

test('normalization: item count capped and input is not mutated', () => {
  const item = Object.freeze({ name: ' X ', price: '1.00' });
  const data = Object.freeze({ items: Object.freeze([item]) });
  assert.equal(normalizeReceiptData(data).items[0].name, 'X');
  assert.equal(item.name, ' X ');
  assert.equal(normalizeReceiptData({ items: Array(100).fill(item) }).items.length, 100);
  assert.throws(() => normalizeReceiptData({ items: Array(101).fill(item) }), /Too many/);
});

test('extraction: image validation runs before external calls', async () => {
  const mocked = provider();
  await assert.rejects(() => extractReceipt(TEXT, 'image/png'), /corrupted/);
  await assert.rejects(() => extractReceipt(JPEG, 'image/png'), /do not match/);
  await assert.rejects(() => extractReceipt(Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image/jpeg'), /too large/);
  assert.equal(mocked.mock.callCount(), 0);
});

test('extraction: missing credentials produce NOT_CONFIGURED', async () => {
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(() => extractReceipt(JPEG, 'image/jpeg'), { code: 'NOT_CONFIGURED' });
});

test('extraction: provider receives validated bytes and returns normalized JSON', async () => {
  const mocked = provider();
  assert.deepEqual(await extractReceipt(JPEG, 'image/jpeg'), normalized);
  const options = mocked.mock.calls[0].arguments[1];
  const body = JSON.parse(options.body);
  assert.equal(options.headers.Authorization, 'Bearer test-only-key');
  // OpenRouter free-model router with OpenAI-compatible chat completions.
  assert.equal(body.model, 'openrouter/free');
  assert.equal(body.store, false);
  assert.equal(body.messages[1].content[0].image_url.url, `data:image/jpeg;base64,${JPEG.toString('base64')}`);
  assert.ok(options.signal instanceof AbortSignal);
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
    await assert.rejects(() => extractReceipt(JPEG, 'image/jpeg'), { code: 'INVALID_RESPONSE' });
    mocked.mock.restore();
  }
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
      [uploadForm('application/pdf', TEXT), 'INVALID_UPLOAD'],
      [uploadForm('image/heic', TEXT), 'INVALID_UPLOAD'],
      [uploadForm('image/png', TEXT), 'INVALID_IMAGE'],
      [uploadForm('image/png', JPEG), 'INVALID_IMAGE'],
      [uploadForm('image/jpeg', JPEG, 'wrong'), 'INVALID_UPLOAD'],
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
    const big = await post(base, uploadForm('image/jpeg', Buffer.alloc(MAX_IMAGE_BYTES + 1)));
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
    const res = await post(base);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), normalized);
  });
  assert.equal(mocked.mock.callCount(), 1);
});

test('route: invalid AI prices reject the entire extraction with 422', async () => {
  provider(fakeReply(JSON.stringify({ items: [{ name: 'Good', price: 10 }, { name: 'Bad', price: -1 }] })));
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
