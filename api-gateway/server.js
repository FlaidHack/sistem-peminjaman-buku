// Fase 4: API Gateway :3000 — satu pintu untuk frontend.
// Tanggung jawab: CORS, verify Bearer JWT, inject x-user-id + x-api-key per
// tujuan, proxy ke service terkait, dan agregasi health.
// Gateway tidak memakai express.json() supaya body request dialirkan mentah
// ke service tujuan (kalau body di-parse di sini, body tidak ikut terkirim).
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const proxyRouter = require('./routes/proxy');

const app = express();
const PORT = process.env.PORT || 3000;
const HEALTH_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 3000);

const UPSTREAMS = [
  { name: 'auth', label: 'Auth', url: process.env.AUTH_URL },
  { name: 'catalog', label: 'Katalog', url: process.env.CATALOG_URL },
  { name: 'loan', label: 'Loan', url: process.env.LOAN_URL }
];

// Fail-fast: tanpa env ini gateway hanya bisa jadi 401/503. Puttingan konfigurasi
// di log jauh lebih berguna daripada error panjang saat request pertama datang.
const REQUIRED = [
  'AUTH_URL', 'CATALOG_URL', 'LOAN_URL',
  'AUTH_API_KEY', 'CATALOG_API_KEY', 'LOAN_API_KEY', 'JWT_SECRET'
];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`api-gateway: .env belum lengkap, kurang: ${missing.join(', ')}`);
  console.error('Salin nilai dari api-gateway/.env ke .env tiap service (key & JWT_SECRET harus sama).');
  process.exit(1);
}

app.use(cors());

// GET /health -> agregat: cek /health ketiga service sekaligus.
app.get('/health', async (req, res) => {
  const results = await Promise.all(
    UPSTREAMS.map(async (up) => {
      if (!up.url) return { ok: false, detail: 'URL belum dikonfigurasi' };
      try {
        const r = await fetch(`${up.url}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
        if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
        return { ok: true, detail: await r.json() };
      } catch (err) {
        const timeout = err && (err.name === 'TimeoutError' || err.code === 23);
        return { ok: false, detail: timeout ? 'timeout' : 'tidak dapat dihubungi' };
      }
    })
  );

  const services = {};
  let allOk = true;
  UPSTREAMS.forEach((up, i) => {
    services[up.name] = { label: up.label, url: up.url, ...results[i] };
    if (!results[i].ok) allOk = false;
  });

  return res.status(allOk ? 200 : 503).json({
    success: allOk,
    service: 'api-gateway',
    status: allOk ? 'ok' : 'degraded',
    port: PORT,
    services
  });
});

// Semua /api/* masuk ke proxy router; route tak dikenal jatuh ke 404 di bawah.
app.use('/', proxyRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});

app.listen(PORT, () => {
  console.log(`api-gateway jalan di http://localhost:${PORT}`);
});