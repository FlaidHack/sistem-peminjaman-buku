// Tahap 1: implementasi login (US-01 / AC-01) + GET user by id (untuk loan-service).
const express = require('express');

const router = express.Router();

// TODO Tahap 1:
// POST /login { nim, password } -> validasi users.json, return { success, user, token }
// GET /users/:id -> return user tanpa password (dipakai loan-service)

router.post('/login', (req, res) => {
  res.status(501).json({ success: false, message: 'Belum diimplementasi (Tahap 1)' });
});

router.get('/users/:id', (req, res) => {
  res.status(501).json({ success: false, message: 'Belum diimplementasi (Tahap 1)' });
});

module.exports = router;
