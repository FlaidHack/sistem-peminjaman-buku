require('dotenv').config();
const express = require('express');
const requireApiKey = require('./middleware/apiKey');
const booksRouter = require('./routes/books');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS hanya di api-gateway (:3000); service ini dipanggil via HTTP server-to-server.
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'catalog-service', status: 'ok', port: PORT });
});

// Semua route di bawah wajib x-api-key (direct tanpa key -> 401)
app.use('/api', requireApiKey, booksRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});

app.listen(PORT, () => {
  console.log(`catalog-service jalan di http://localhost:${PORT}`);
});