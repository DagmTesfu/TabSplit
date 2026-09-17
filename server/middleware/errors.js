// middleware/errors.js — final error handler and unknown-API-route fallback.

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Express requires four arguments to recognize error middleware.
// Do not log request/provider errors that might contain receipt data or secrets.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
