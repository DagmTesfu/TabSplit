// middleware/rateLimit.js — In-memory server-side rate limiter for TabSplit V1.
// Protects expensive endpoints (especially vision AI extraction) by IP address.
// Includes bounded memory eviction, Retry-After header, and structured JSON errors.

export function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  maxRequests = 60,
  message = 'Too many requests. Please try again later.',
  maxEntries = 5000,
  keyGenerator = getClientIp,
  getTime = () => Date.now(),
} = {}) {
  const store = new Map();

  function cleanup(now) {
    for (const [key, record] of store.entries()) {
      if (now >= record.resetAt) {
        store.delete(key);
      }
    }
  }

  const limiter = (req, res, next) => {
    const key = keyGenerator(req);
    if (!key) return next();

    const now = getTime();

    // Guard against unbounded memory growth if flooded with unique IPs
    if (store.size >= maxEntries) {
      cleanup(now);
      if (store.size >= maxEntries) {
        const oldestKey = store.keys().next().value;
        if (oldestKey) store.delete(oldestKey);
      }
    }

    const record = store.get(key);

    if (!record || now >= record.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count < maxRequests) {
      record.count += 1;
      return next();
    }

    // Limit exceeded: calculate remaining seconds for Retry-After
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(429).json({
      error: message,
      code: 'RATE_LIMITED',
    });
  };

  limiter.reset = () => store.clear();
  limiter.store = store;

  return limiter;
}

// 10 requests per 15 minutes per IP for expensive receipt extraction
export const extractRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many receipt extraction requests. Please try again later.',
});

// 60 requests per 15 minutes per IP for bill creation and lookup
export const billsRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 60,
  message: 'Too many bill requests. Please try again later.',
});
