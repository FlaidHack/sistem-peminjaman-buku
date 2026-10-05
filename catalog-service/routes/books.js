// Fase 2: katalog buku di catalog_db (AC-02). Akses hanya via x-api-key (middleware global).
// Login & data user pindah ke auth-service, jadi service ini murni katalog.
const express = require('express');
const { pool, query } = require('../db');

const router = express.Router();
const BOOK_FIELDS = 'id, title, author, category, status';
const VALID_STATUS = ['available', 'borrowed'];

const DB_ERROR = { success: false, message: 'Database tidak tersedia' };

// GET /books -> seluruh koleksi + status (AC-02)
router.get('/books', async (req, res) => {
  let books;
  try {
    books = await query(`SELECT ${BOOK_FIELDS} FROM books ORDER BY id`);
  } catch (err) {
    return res.status(500).json(DB_ERROR);
  }

  return res.json({ success: true, books });
});

// GET /books/:id -> detail satu buku (dipakai loan-service)
router.get('/books/:id', async (req, res) => {
  let rows;
  try {
    rows = await query(`SELECT ${BOOK_FIELDS} FROM books WHERE id = ?`, [req.params.id]);
  } catch (err) {
    return res.status(500).json(DB_ERROR);
  }

  if (!rows[0]) {
    return res.status(404).json({ success: false, message: 'Buku tidak ditemukan' });
  }

  return res.json({ success: true, book: rows[0] });
});

// PATCH /books/:id { status } -> update available/borrowed, hanya untuk loan-service (kunci via x-api-key)
router.patch('/books/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!status) {
    return res.status(400).json({ success: false, message: 'Status harus diisi' });
  }
  if (!VALID_STATUS.includes(status)) {
    return res.status(400).json({ success: false, message: `Status harus salah satu dari: ${VALID_STATUS.join(', ')}` });
  }

  let affected;
  try {
    const [result] = await pool.execute('UPDATE books SET status = ? WHERE id = ?', [status, req.params.id]);
    affected = result.affectedRows;
  } catch (err) {
    return res.status(500).json(DB_ERROR);
  }

  if (affected === 0) {
    return res.status(404).json({ success: false, message: 'Buku tidak ditemukan' });
  }

  let rows;
  try {
    rows = await query(`SELECT ${BOOK_FIELDS} FROM books WHERE id = ?`, [req.params.id]);
  } catch (err) {
    return res.status(500).json(DB_ERROR);
  }

  return res.json({ success: true, book: rows[0] });
});

module.exports = router;