// TabSplit server: importing the app in tests does not open a port.
import { pathToFileURL } from 'node:url';
import express from 'express';
import aiRoutes from './routes/extract.js';
import { notFoundHandler, errorHandler } from './middleware/errors.js';

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// The router defines /extract-receipt, so mount it once at /api.
app.use('/api', aiRoutes);
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
