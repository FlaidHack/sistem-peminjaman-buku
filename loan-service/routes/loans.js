// Tahap 2: implementasi sirkulasi (US-03/US-04/US-05 / AC-03 s/d AC-07).
// Fase 2: dataloan pindah ke loan_db (MySQL); user divalidasi via auth-service.
const express = require('express');
const { query } = require('../db');
const catalogClient = require('../services/catalogClient');
const authClient = require('../services/authClient');

const router = express.Router();
const MAX_LOANS = 3;
const BORROW_DAYS = 7;

const DB_ERROR = { success: false, message: 'Database tidak tersedia' };

function generateLoanId() {
  return `LN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// Bentuk respons loan tetap camelCase seperti kontrak lama (frontend + test).
function toLoan(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    bookId: row.book_id,
    borrowDate: row.borrow_date,
    dueDate: row.due_date
  };
}

// Bedakan service mati/tak terjangkau vs lambat (timeout): pesan 503 berbeda,
// status tetap 503 agar kontrak error konsisten untuk frontend.
function dependencyError(err, client, label) {
  if (client.isTimeout(err)) {
    return { status: 503, message: `${label} service timeout, coba lagi` };
  }
  return { status: 503, message: `${label} service tidak tersedia` };
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const INSERT_SQL = 'INSERT INTO loans (id, student_id, book_id, borrow_date, due_date) VALUES (?, ?, ?, ?, ?)';

// POST /loans { studentId, bookId } -> validasi via auth+catalog, maks 3 aktif, dueDate +7 hari
router.post('/loans', async (req, res) => {
  const { studentId, bookId } = req.body || {};

  if (!studentId || !bookId) {
    return res.status(400).json({ success: false, message: 'studentId dan bookId harus diisi' });
  }

  let user;
  try {
    user = await authClient.getUser(studentId);
  } catch (err) {
    const e = dependencyError(err, authClient, 'Auth');
    return res.status(e.status).json({ success: false, message: e.message });
  }
  if (!user) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }

  let book;
  try {
    book = await catalogClient.getBook(bookId);
  } catch (err) {
    const e = dependencyError(err, catalogClient, 'Katalog');
    return res.status(e.status).json({ success: false, message: e.message });
  }
  if (!book) {
    return res.status(404).json({ success: false, message: 'Buku tidak ditemukan' });
  }
  if (book.book.status !== 'available') {
    return res.status(409).json({ success: false, message: 'Buku sedang dipinjam oleh pengguna lain' });
  }

  let countRows;
  try {
    countRows = await query('SELECT COUNT(*) AS total FROM loans WHERE student_id = ?', [studentId]);
  } catch (err) {
    return res.status(500).json(DB_ERROR);
  }
  if (Number(countRows[0].total) >= MAX_LOANS) {
    return res.status(400).json({ success: false, message: `Batas maksimal peminjaman (${MAX_LOANS} buku) telah tercapai` });
  }

  const today = getTodayStr();
  const loan = {
    id: generateLoanId(),
    student_id: studentId,
    book_id: bookId,
    borrow_date: today,
    due_date: addDays(today, BORROW_DAYS)
  };

  try {
    await query(INSERT_SQL, [loan.id, loan.student_id, loan.book_id, loan.borrow_date, loan.due_date]);
  } catch (err) {
    return res.status(500).json(DB_ERROR);
  }

  try {
    await catalogClient.setBookStatus(bookId, 'borrowed');
  } catch (err) {
    try {
      await query('DELETE FROM loans WHERE id = ?', [loan.id]);
    } catch (rollbackErr) {
      return res.status(500).json(DB_ERROR);
    }
    const e = dependencyError(err, catalogClient, 'Katalog');
    return res.status(e.status).json({ success: false, message: e.message });
  }

  return res.status(201).json({ success: true, loan: toLoan(loan) });
});

// GET /loans?studentId=... -> daftar aktif + enrich judul (AC-06)
router.get('/loans', async (req, res) => {
  const { studentId } = req.query;

  let rows;
  try {
    rows = studentId
      ? await query('SELECT * FROM loans WHERE student_id = ? ORDER BY borrow_date, id', [studentId])
      : await query('SELECT * FROM loans ORDER BY borrow_date, id');
  } catch (err) {
    return res.status(500).json(DB_ERROR);
  }

  const result = [];
  for (const row of rows) {
    let book;
    try {
      book = await catalogClient.getBook(row.book_id);
    } catch (err) {
      const e = dependencyError(err, catalogClient, 'Katalog');
      return res.status(e.status).json({ success: false, message: e.message });
    }
    result.push(Object.assign(toLoan(row), { title: book ? book.book.title : null }));
  }

  return res.json({ success: true, loans: result });
});

// POST /loans/:id/return -> hapus loan + kembalikan status buku (AC-07)
router.post('/loans/:id/return', async (req, res) => {
  let rows;
  try {
    rows = await query('SELECT * FROM loans WHERE id = ?', [req.params.id]);
  } catch (err) {
    return res.status(500).json(DB_ERROR);
  }

  if (!rows[0]) {
    return res.status(404).json({ success: false, message: 'Data peminjaman tidak ditemukan' });
  }

  const loan = rows[0];

  try {
    await query('DELETE FROM loans WHERE id = ?', [loan.id]);
  } catch (err) {
    return res.status(500).json(DB_ERROR);
  }

  try {
    await catalogClient.setBookStatus(loan.book_id, 'available');
  } catch (err) {
    try {
      await query(INSERT_SQL, [loan.id, loan.student_id, loan.book_id, loan.borrow_date, loan.due_date]);
    } catch (rollbackErr) {
      return res.status(500).json(DB_ERROR);
    }
    const e = dependencyError(err, catalogClient, 'Katalog');
    return res.status(e.status).json({ success: false, message: e.message });
  }

  return res.json({ success: true, message: 'Buku berhasil dikembalikan' });
});

module.exports = router;