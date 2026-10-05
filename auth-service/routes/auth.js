// Fase 1: login/logout/me + GET user internal (PRD §4.1).
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const router = express.Router();

function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

function requireJwt(req, res, next) {
  const token = getBearer(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    req.token = token;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau kedaluwarsa' });
  }
}

// POST /api/auth/login { nim, password } -> 200 { user, token } / 400 / 401
router.post('/auth/login', async (req, res) => {
  const { nim, password } = req.body || {};
  if (!nim || !password) {
    return res.status(400).json({ success: false, message: 'NIM dan password harus diisi' });
  }

  let rows;
  try {
    rows = await query('SELECT id, name, password_hash FROM users WHERE id = ?', [nim]);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Database tidak tersedia' });
  }

  const found = rows[0];
  if (!found) {
    return res.status(401).json({ success: false, message: 'NIM atau password salah' });
  }

  const ok = await bcrypt.compare(password, found.password_hash);
  if (!ok) {
    return res.status(401).json({ success: false, message: 'NIM atau password salah' });
  }

  const token = jwt.sign(
    { sub: found.id, name: found.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '2h' }
  );

  return res.json({
    success: true,
    user: { id: found.id, name: found.name },
    token
  });
});

// POST /api/auth/logout -> butuh Bearer valid -> 200 (stateless, formalitas)
router.post('/auth/logout', requireJwt, (req, res) => {
  return res.json({ success: true, message: 'Logout berhasil' });
});

// GET /api/auth/me -> profil dari klaim JWT (tanpa query DB, sesuai PRD)
router.get('/auth/me', requireJwt, (req, res) => {
  return res.json({
    success: true,
    user: { id: req.auth.sub, name: req.auth.name }
  });
});

// GET /api/users/:id -> internal untuk loan-service (wajib x-api-key via global middleware), tanpa password
router.get('/users/:id', async (req, res) => {
  let rows;
  try {
    rows = await query('SELECT id, name FROM users WHERE id = ?', [req.params.id]);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Database tidak tersedia' });
  }

  const found = rows[0];
  if (!found) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }

  return res.json({ success: true, user: { id: found.id, name: found.name } });
});

module.exports = router;
