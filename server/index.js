// TabSplit server: importing the app in tests does not open a port.
import { pathToFileURL } from 'node:url';
import express from 'express';
import aiRoutes from './routes/extract.js';
import billRoutes from './routes/bills.js';
import { notFoundHandler, errorHandler, requestLogger } from './middleware/errors.js';
import { corsMiddleware } from './middleware/cors.js';

const app = express();

if (process.env.TRUST_PROXY) {
  const val = process.env.TRUST_PROXY.trim();
  if (val === 'true') {
    app.set('trust proxy', 1);
  } else if (/^\d+$/.test(val)) {
    app.set('trust proxy', parseInt(val, 10));
  } else {
    app.set('trust proxy', val);
  }
}

// One short log line per request; bodies and credentials are never logged.
app.use(requestLogger);

// Strict origin validation and CORS preflight handling.
app.use(corsMiddleware);

// JSON bodies for the bills API; small cap is plenty for bill payloads.
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// The router defines /extract-receipt, so mount it once at /api.
app.use('/api', aiRoutes);
app.use('/api', billRoutes);
app.use('/api', notFoundHandler);
app.use(errorHandler);

// Only the CLI entry point starts the production/development listener.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`TabSplit server listening on http://localhost:${port}`);
  });
}

export default app;
