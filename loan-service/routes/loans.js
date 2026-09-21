// Tahap 2: implementasi sirkulasi (US-03/US-04/US-05 / AC-03 s/d AC-07).
const express = require('express');

const router = express.Router();

// TODO Tahap 2:
// POST /loans { studentId, bookId } -> validasi via catalogClient, maks 3 aktif, dueDate +7 hari
// GET /loans?studentId=... -> daftar aktif + enrich judul (AC-06)
// POST /loans/:id/return -> hapus loan + kembalikan status buku (AC-07)

router.post('/loans', (req, res) => {
  res.status(501).json({ success: false, message: 'Belum diimplementasi (Tahap 2)' });
});

router.get('/loans', (req, res) => {
  res.status(501).json({ success: false, message: 'Belum diimplementasi (Tahap 2)' });
});

router.post('/loans/:id/return', (req, res) => {
  res.status(501).json({ success: false, message: 'Belum diimplementasi (Tahap 2)' });
});

module.exports = router;
