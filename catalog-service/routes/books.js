// Tahap 1: implementasi katalog (US-02 / AC-02) + endpoint internal untuk loan-service.
const express = require('express');

const router = express.Router();

// TODO Tahap 1:
// GET /books -> seluruh koleksi + status (AC-02)
// GET /books/:id -> detail satu buku (dipakai loan-service)
// PATCH /books/:id { status } -> update available/borrowed, kunci via x-internal-key (dipakai loan-service)

router.get('/books', (req, res) => {
  res.status(501).json({ success: false, message: 'Belum diimplementasi (Tahap 1)' });
});

router.get('/books/:id', (req, res) => {
  res.status(501).json({ success: false, message: 'Belum diimplementasi (Tahap 1)' });
});

router.patch('/books/:id', (req, res) => {
  res.status(501).json({ success: false, message: 'Belum diimplementasi (Tahap 1)' });
});

module.exports = router;
