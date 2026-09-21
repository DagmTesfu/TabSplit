// middleware/cors.js — strict origin validation and preflight handling.
// Does not reflect arbitrary Origin headers; allows only configured origins.
// No credentials (cookies) needed for TabSplit V1.

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

export function getAllowedOrigins() {
  const origins = new Set(DEFAULT_DEV_ORIGINS);

  const addFromEnv = (raw) => {
    if (!raw || typeof raw !== 'string') return;
    raw.split(',').forEach((item) => {
      const trimmed = item.trim().replace(/\/+$/, '');
      if (trimmed) origins.add(trimmed);
    });
  };

  addFromEnv(process.env.CLIENT_ORIGIN);
  addFromEnv(process.env.PUBLIC_APP_URL);

  return origins;
}

export function isOriginAllowed(origin) {
  if (!origin || typeof origin !== 'string') return false;
  const normalized = origin.trim().replace(/\/+$/, '');
  const allowed = getAllowedOrigins();
  return allowed.has(normalized);
}

export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  // Requests without an Origin header (e.g. curl, server-to-server, same-origin)
  if (!origin) {
    return next();
  }

  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    return next();
  }

  // Origin is not allowed
  if (req.method === 'OPTIONS') {
    return res.status(403).json({ error: 'Origin not allowed by CORS' });
  }

  // For non-OPTIONS requests from unauthorized origins, proceed without setting
  // Access-Control-Allow-Origin header so the browser's CORS policy blocks access.
  res.setHeader('Vary', 'Origin');
  return next();
}
