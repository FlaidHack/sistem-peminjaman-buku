const express = require('express');
const cors = require('cors');
const usersRouter = require('./routes/users');
const booksRouter = require('./routes/books');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'catalog-service', status: 'ok', port: PORT });
});

app.use('/api', usersRouter);
app.use('/api', booksRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});

app.listen(PORT, () => {
  console.log(`catalog-service jalan di http://localhost:${PORT}`);
});
