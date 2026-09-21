// Tahap 2: implementasi sirkulasi (US-03/US-04/US-05 / AC-03 s/d AC-07).
const express = require('express');
const catalogClient = require('../services/catalogClient');
const { readJson, writeJson, loansFile, MAX_LOANS, BORROW_DAYS } = require('./store');

const router = express.Router();

function generateLoanId() {
  return `LN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// POST /loans { studentId, bookId } -> validasi via catalogClient, maks 3 aktif, dueDate +7 hari
router.post('/loans', async (req, res) => {
  const { studentId, bookId } = req.body || {};

  if (!studentId || !bookId) {
    return res.status(400).json({ success: false, message: 'studentId dan bookId harus diisi' });
  }

  let user;
  try {
    user = await catalogClient.getUser(studentId);
  } catch (err) {
    return res.status(503).json({ success: false, message: 'Katalog service tidak tersedia' });
  }
  if (!user) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }

  let book;
  try {
    book = await catalogClient.getBook(bookId);
  } catch (err) {
    return res.status(503).json({ success: false, message: 'Katalog service tidak tersedia' });
  }
  if (!book) {
    return res.status(404).json({ success: false, message: 'Buku tidak ditemukan' });
  }
  if (book.book.status !== 'available') {
    return res.status(409).json({ success: false, message: 'Buku sedang dipinjam oleh pengguna lain' });
  }

  const loans = readJson(loansFile);
  const activeCount = loans.filter(l => l.studentId === studentId).length;
  if (activeCount >= MAX_LOANS) {
    return res.status(400).json({ success: false, message: `Batas maksimal peminjaman (${MAX_LOANS} buku) telah tercapai` });
  }

  const today = getTodayStr();
  const loan = {
    id: generateLoanId(),
    studentId,
    bookId,
    borrowDate: today,
    dueDate: addDays(today, BORROW_DAYS)
  };

  loans.push(loan);
  writeJson(loansFile, loans);

  try {
    await catalogClient.setBookStatus(bookId, 'borrowed');
  } catch (err) {
    const rolledBack = readJson(loansFile).filter(l => l.id !== loan.id);
    writeJson(loansFile, rolledBack);
    return res.status(503).json({ success: false, message: 'Katalog service tidak tersedia' });
  }

  return res.status(201).json({ success: true, loan });
});

// GET /loans?studentId=... -> daftar aktif + enrich judul (AC-06)
router.get('/loans', async (req, res) => {
  const { studentId } = req.query;
  let loans = readJson(loansFile);

  if (studentId) {
    loans = loans.filter(l => l.studentId === studentId);
  }

  const result = [];
  for (const loan of loans) {
    let book;
    try {
      book = await catalogClient.getBook(loan.bookId);
    } catch (err) {
      return res.status(503).json({ success: false, message: 'Katalog service tidak tersedia' });
    }
    result.push({ ...loan, title: book ? book.book.title : null });
  }

  return res.json({ success: true, loans: result });
});

// POST /loans/:id/return -> hapus loan + kembalikan status buku (AC-07)
router.post('/loans/:id/return', async (req, res) => {
  const loans = readJson(loansFile);
  const index = loans.findIndex(l => l.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Data peminjaman tidak ditemukan' });
  }

  const [loan] = loans.splice(index, 1);
  writeJson(loansFile, loans);

  try {
    await catalogClient.setBookStatus(loan.bookId, 'available');
  } catch (err) {
    const rolledBack = readJson(loansFile);
    rolledBack.push(loan);
    writeJson(loansFile, rolledBack);
    return res.status(503).json({ success: false, message: 'Katalog service tidak tersedia' });
  }

  return res.json({ success: true, message: 'Buku berhasil dikembalikan' });
});

module.exports = router;