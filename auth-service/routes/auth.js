// Fase 1: login/logout/me + GET user internal (PRD §4.1).
// Logout stateful: tiap JWT punya jti, logout memasukkan jti ke revoked_tokens.
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const router = express.Router();

function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

async function requireJwt(req, res, next) {
  const token = getBearer(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  }
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau kedaluwarsa' });
  }
  if (!payload.jti) {
    return res.status(401).json({ success: false, message: 'Token versi lama, silakan login ulang' });
  }
  try {
    const rows = await query('SELECT jti FROM revoked_tokens WHERE jti = ?', [payload.jti]);
    if (rows.length > 0) {
      return res.status(401).json({ success: false, message: 'Token sudah logout, silakan login kembali' });
    }
  } catch (err) {
    return res.status(503).json({ success: false, message: 'Database tidak tersedia' });
  }
  req.auth = payload;
  req.token = token;
  return next();
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
    { sub: found.id, name: found.name, jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '2h' }
  );

  return res.json({
    success: true,
    user: { id: found.id, name: found.name },
    token
  });
});

// POST /api/auth/logout -> butuh Bearer valid -> revoke jti -> 200
// Idempotent: logout 2x dengan token yang sama tetap 200 (INSERT IGNORE).
router.post('/auth/logout', requireJwt, async (req, res) => {
  try {
    await query(
      'INSERT IGNORE INTO revoked_tokens (jti, user_id, expires_at) VALUES (?, ?, FROM_UNIXTIME(?))',
      [req.auth.jti, req.auth.sub, req.auth.exp]
    );
  } catch (err) {
    return res.status(503).json({ success: false, message: 'Database tidak tersedia' });
  }
  return res.json({ success: true, message: 'Logout berhasil' });
});

// GET /api/auth/me -> profil dari klaim JWT (tanpa query DB, sesuai PRD)
router.get('/auth/me', requireJwt, (req, res) => {
  return res.json({
    success: true,
    user: { id: req.auth.sub, name: req.auth.name }
  });
});

// GET /api/internal/sessions/check?jti=... -> internal untuk gateway (wajib x-api-key).
// Dipakai gateway setiap request proteksi supaya token yang sudah logout ditolak di semua endpoint.
router.get('/internal/sessions/check', async (req, res) => {
  const jti = req.query.jti;
  if (!jti) {
    return res.status(400).json({ success: false, message: 'jti harus diisi' });
  }
  try {
    const rows = await query('SELECT jti FROM revoked_tokens WHERE jti = ?', [jti]);
    return res.json({ success: true, revoked: rows.length > 0 });
  } catch (err) {
    return res.status(503).json({ success: false, message: 'Database tidak tersedia' });
  }
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
