// Fase 2: client HTTP dari loan-service -> auth-service untuk validasi user.
// Prinsip: loan-service TIDAK membaca auth_db (user) langsung, semua lewat HTTP.
// Antesnya validasi user dilayani catalog-service; sejak Fase 2 pemilik data user
// adalah auth-service (:3003).
const AUTH_BASE = process.env.AUTH_SERVICE_URL || 'http://localhost:3003';
const API_KEY = process.env.AUTH_API_KEY;
const TIMEOUT_MS = Number(process.env.AUTH_TIMEOUT_MS || process.env.CATALOG_TIMEOUT_MS || 5000);

function timeoutSignal() {
  return AbortSignal.timeout(TIMEOUT_MS);
}

async function getUser(studentId) {
  const res = await fetch(`${AUTH_BASE}/api/users/${studentId}`, {
    headers: { 'x-api-key': API_KEY },
    signal: timeoutSignal()
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`auth-service getUser gagal: ${res.status}`);
  return res.json();
}

function isTimeout(err) {
  return !!err && (err.name === 'TimeoutError' || err.code === 23 || /timeout|aborted/i.test(err.message || ''));
}

module.exports = { getUser, AUTH_BASE, TIMEOUT_MS, isTimeout };