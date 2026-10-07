// Fase 4: verifikasi JWT di sisi gateway. Ini satu-satunya tempat token dicek
// untuk permintaan dari frontend; downstream (auth/catalog/loan) tidak perlu
// verify JWT, cukup cek x-api-key dan percaya x-user-id dari gateway.
// Stateful: setelah jwt.verify, jti dicek ke auth-service supaya token yang
// sudah logout ditolak di SEMUA endpoint (buku, loans, me), bukan cuma di auth.
const jwt = require('jsonwebtoken');

const REVOKE_CHECK_TIMEOUT_MS = Number(process.env.AUTH_CHECK_TIMEOUT_MS || 5000);

function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

async function verifyJwt(req, res, next) {
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
    const r = await fetch(
      `${process.env.AUTH_URL}/api/internal/sessions/check?jti=${encodeURIComponent(payload.jti)}`,
      {
        headers: { 'x-api-key': process.env.AUTH_API_KEY },
        signal: AbortSignal.timeout(REVOKE_CHECK_TIMEOUT_MS)
      }
    );
    if (!r.ok) {
      return res.status(503).json({ success: false, message: 'Auth service tidak tersedia' });
    }
    const data = await r.json();
    if (data.revoked) {
      return res.status(401).json({ success: false, message: 'Token sudah logout, silakan login kembali' });
    }
  } catch (err) {
    return res.status(503).json({ success: false, message: 'Auth service tidak tersedia' });
  }

  req.user = { id: payload.sub, name: payload.name };
  req.token = token;
  return next();
}

module.exports = verifyJwt;