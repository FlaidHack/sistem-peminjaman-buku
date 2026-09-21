// Tahap 1: implementasi login (US-01 / AC-01) + GET user by id (untuk loan-service).
const express = require('express');
const { readJson, usersFile } = require('./store');

const router = express.Router();

// POST /login { nim, password } -> validasi users.json, return { success, user, token }
router.post('/login', (req, res) => {
  const { nim, password } = req.body;
  if (!nim || !password) {
    return res.status(400).json({ success: false, message: 'NIM dan password harus diisi' });
  }

  const users = readJson(usersFile);
  const user = users.find(u => u.id === nim && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'NIM atau password salah' });
  }

  const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
  res.json({ success: true, user: { id: user.id, name: user.name }, token });
});

// GET /users/:id -> return user tanpa password (dipakai loan-service)
router.get('/users/:id', (req, res) => {
  const users = readJson(usersFile);
  const user = users.find(u => u.id === req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }

  res.json({ success: true, user: { id: user.id, name: user.name } });
});

module.exports = router;
