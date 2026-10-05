// Fase 2: client HTTP dari loan-service -> catalog-service.
// Prinsip: loan-service TIDAK membaca catalog_db (buku) langsung, semua lewat HTTP.
const CATALOG_BASE = process.env.CATALOG_SERVICE_URL || 'http://localhost:3001';
const API_KEY = process.env.CATALOG_API_KEY;
// Batas waktu tiap panggilan ke catalog-service agar S2 tidak hang selamanya
// jika S1 hidup tapi tidak merespons. Bisa dioverride via env untuk pengujian.
const TIMEOUT_MS = Number(process.env.CATALOG_TIMEOUT_MS || 5000);

function authHeaders(extra) {
  return Object.assign({ 'x-api-key': API_KEY }, extra || {});
}

function timeoutSignal() {
  return AbortSignal.timeout(TIMEOUT_MS);
}

async function getBook(bookId) {
  const res = await fetch(`${CATALOG_BASE}/api/books/${bookId}`, {
    headers: authHeaders(),
    signal: timeoutSignal()
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`catalog-service getBook gagal: ${res.status}`);
  return res.json();
}

async function setBookStatus(bookId, status) {
  const res = await fetch(`${CATALOG_BASE}/api/books/${bookId}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
    signal: timeoutSignal()
  });
  if (!res.ok) throw new Error(`catalog-service setBookStatus gagal: ${res.status}`);
  return res.json();
}

function isTimeout(err) {
  return !!err && (err.name === 'TimeoutError' || err.code === 23 || /timeout|aborted/i.test(err.message || ''));
}

module.exports = { getBook, setBookStatus, CATALOG_BASE, TIMEOUT_MS, isTimeout };