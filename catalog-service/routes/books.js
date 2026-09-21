// Tahap 1: implementasi katalog (US-02 / AC-02) + endpoint internal untuk loan-service.
const express = require('express');
const { readJson, writeJson, booksFile } = require('./store');

const router = express.Router();
const INTERNAL_KEY = process.env.INTERNAL_KEY || 'dev-internal-key';

// GET /books -> seluruh koleksi + status (AC-02)
router.get('/books', (req, res) => {
  const books = readJson(booksFile);
  res.json({ success: true, books });
});

// GET /books/:id -> detail satu buku (dipakai loan-service)
router.get('/books/:id', (req, res) => {
  const books = readJson(booksFile);
  const book = books.find(b => b.id === req.params.id);

  if (!book) {
    return res.status(404).json({ success: false, message: 'Buku tidak ditemukan' });
  }

  res.json({ success: true, book });
});

// PATCH /books/:id { status } -> update available/borrowed, kunci via x-internal-key (dipakai loan-service)
router.patch('/books/:id', (req, res) => {
  const xKey = req.headers['x-internal-key'];
  if (xKey !== INTERNAL_KEY) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: 'Status harus diisi' });
  }

  const books = readJson(booksFile);
  const index = books.findIndex(b => b.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Buku tidak ditemukan' });
  }

  books[index].status = status;
  writeJson(booksFile, books);

  res.json({ success: true, book: books[index] });
});

module.exports = router;
