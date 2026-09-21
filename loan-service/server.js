const express = require('express');
const cors = require('cors');
const loansRouter = require('./routes/loans');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'loan-service', status: 'ok', port: PORT });
});

app.use('/api', loansRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});

app.listen(PORT, () => {
  console.log(`loan-service jalan di http://localhost:${PORT}`);
});
