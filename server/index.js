// TabSplit server: importing the app in tests does not open a port.
import { pathToFileURL } from 'node:url';
import express from 'express';
import aiRoutes from './routes/extract.js';
import billRoutes from './routes/bills.js';
import { notFoundHandler, errorHandler, requestLogger } from './middleware/errors.js';

const app = express();

// One short log line per request; bodies and credentials are never logged.
app.use(requestLogger);

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
