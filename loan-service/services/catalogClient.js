// Tahap 2: client HTTP dari loan-service -> catalog-service.
// Prinsip: loan-service TIDAK membaca users.json / books.json langsung.
const CATALOG_BASE = process.env.CATALOG_SERVICE_URL || 'http://localhost:3001';
const INTERNAL_KEY = process.env.INTERNAL_KEY || 'dev-internal-key';

async function getUser(studentId) {
  const res = await fetch(`${CATALOG_BASE}/api/users/${studentId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`catalog-service getUser gagal: ${res.status}`);
  return res.json();
}

async function getBook(bookId) {
  const res = await fetch(`${CATALOG_BASE}/api/books/${bookId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`catalog-service getBook gagal: ${res.status}`);
  return res.json();
}

async function setBookStatus(bookId, status) {
  const res = await fetch(`${CATALOG_BASE}/api/books/${bookId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error(`catalog-service setBookStatus gagal: ${res.status}`);
  return res.json();
}

module.exports = { getUser, getBook, setBookStatus, CATALOG_BASE };
