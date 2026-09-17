// middleware/errors.js — final error handler and unknown-API-route fallback.

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Emit one short line per request: method, path, status. Never logs bodies,
// query strings, headers or credentials.
export function requestLogger(req, res, next) {
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
}

// Express requires four arguments to recognize error middleware.
// Logs only safe metadata (error type/code, message) — never bodies, images,
// credentials or provider payloads.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON', code: 'INVALID_JSON' });
  }
  if (err?.type === 'entity.too.large' || err?.statusCode === 413) {
    return res.status(413).json({ error: 'Request body is too large (max 1 MB).', code: 'PAYLOAD_TOO_LARGE' });
  }
  console.error(`error ${req.method} ${req.originalUrl} [${err?.code || err?.name || 'Error'}] ${err?.message || 'unknown'}`);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
