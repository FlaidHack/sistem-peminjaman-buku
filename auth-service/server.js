require('dotenv').config();
const express = require('express');
const cors = require('cors');
const requireApiKey = require('./middleware/apiKey');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'auth-service', status: 'ok', port: PORT });
});

// Semua route di bawah wajib x-api-key (direct tanpa key -> 401)
app.use('/api', requireApiKey, authRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});

app.listen(PORT, () => {
  console.log(`auth-service jalan di http://localhost:${PORT}`);
});
