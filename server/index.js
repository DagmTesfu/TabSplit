import express from 'express';

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`TabSplit server listening on http://localhost:${PORT}`);
});
