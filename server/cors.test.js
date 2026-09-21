// cors.test.js — test suite for Feature 5.12.5.2: Production CORS configuration
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import app from './index.js';
import { isOriginAllowed, getAllowedOrigins } from './middleware/cors.js';

let server;
let baseUrl;

async function startTestServer() {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
}

function stopTestServer() {
  if (server) {
    server.close();
    server = null;
  }
}

afterEach(() => {
  stopTestServer();
  delete process.env.CLIENT_ORIGIN;
  delete process.env.PUBLIC_APP_URL;
});

test('cors: default development origins are allowed by default', () => {
  assert.equal(isOriginAllowed('http://localhost:5173'), true);
  assert.equal(isOriginAllowed('http://127.0.0.1:5173'), true);
  assert.equal(isOriginAllowed('http://localhost:4173'), true);
  assert.equal(isOriginAllowed('http://127.0.0.1:4173'), true);
  assert.equal(isOriginAllowed('http://localhost:5173/'), true, 'handles trailing slash cleanly');
});

test('cors: configured production CLIENT_ORIGIN is allowed', () => {
  process.env.CLIENT_ORIGIN = 'https://tabsplit.vercel.app';
  assert.equal(isOriginAllowed('https://tabsplit.vercel.app'), true);
  assert.equal(isOriginAllowed('https://tabsplit.vercel.app/'), true);
  assert.equal(isOriginAllowed('https://evil-hacker.com'), false);
});

test('cors: comma-separated CLIENT_ORIGIN allows multiple origins', () => {
  process.env.CLIENT_ORIGIN = 'https://tabsplit.com, https://preview.tabsplit.com';
  assert.equal(isOriginAllowed('https://tabsplit.com'), true);
  assert.equal(isOriginAllowed('https://preview.tabsplit.com'), true);
  assert.equal(isOriginAllowed('https://unknown.com'), false);
});

test('cors: PUBLIC_APP_URL origin is also allowed', () => {
  process.env.PUBLIC_APP_URL = 'https://custom-app.com';
  assert.equal(isOriginAllowed('https://custom-app.com'), true);
});

test('cors: request without Origin header succeeds without CORS headers', async () => {
  await startTestServer();

  const res = await fetch(`${baseUrl}/api/health`, {
    method: 'GET',
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data, { ok: true });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('cors: preflight OPTIONS from allowed origin returns 204 with correct CORS headers', async () => {
  process.env.CLIENT_ORIGIN = 'https://tabsplit.vercel.app';
  await startTestServer();

  const res = await fetch(`${baseUrl}/api/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://tabsplit.vercel.app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });

  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://tabsplit.vercel.app');
  assert.equal(res.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');
  assert.equal(res.headers.get('access-control-allow-headers'), 'Content-Type, Authorization');
  assert.equal(res.headers.get('access-control-max-age'), '86400');
  assert.equal(res.headers.get('access-control-allow-credentials'), null, 'no credentials for V1');
});

test('cors: preflight OPTIONS from unauthorized origin returns 403', async () => {
  process.env.CLIENT_ORIGIN = 'https://tabsplit.vercel.app';
  await startTestServer();

  const res = await fetch(`${baseUrl}/api/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.com',
      'Access-Control-Request-Method': 'POST',
    },
  });

  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  const data = await res.json();
  assert.equal(data.error, 'Origin not allowed by CORS');
});

test('cors: GET from allowed localhost origin returns 200 and Access-Control-Allow-Origin', async () => {
  await startTestServer();

  const res = await fetch(`${baseUrl}/api/health`, {
    method: 'GET',
    headers: {
      Origin: 'http://localhost:5173',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('cors: GET from disallowed origin does not include Access-Control-Allow-Origin', async () => {
  await startTestServer();

  const res = await fetch(`${baseUrl}/api/health`, {
    method: 'GET',
    headers: {
      Origin: 'https://unauthorized-site.com',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), null, 'browser blocks response due to missing header');
});
