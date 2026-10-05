// Fase 4: verifikasi JWT di sisi gateway. Ini satu-satunya tempat token dicek
// untuk permintaan dari frontend; downstream (auth/catalog/loan) tidak perlu
// verify JWT, cukup cek x-api-key dan percaya x-user-id dari gateway.
const jwt = require('jsonwebtoken');

function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

function verifyJwt(req, res, next) {
  const token = getBearer(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, name: payload.name };
    req.token = token;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau kedaluwarsa' });
  }
}

module.exports = verifyJwt;