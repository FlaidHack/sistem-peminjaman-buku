// Fase 4: satu-satunya pintu proxy dari frontend ke 3 service.
// Dispatcher dipanggil tanpa argumen path supaya req.url tetap utuh;
// kalau path-nya dipisah per route, Express memotong prefix dan proxy
// akan meneruskan URL yang sudah terpotong.
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const verifyJwt = require('../middleware/verifyJwt');

const router = express.Router();
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 10000);

function makeProxy(name, target, apiKey) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: PROXY_TIMEOUT_MS,
    on: {
      // Header dari browser tidak dipercaya: hapus dulu supaya tidak bisa
      // dipalsukan, lalu gateway yang meng-inject nilai yang benar.
      proxyReq(proxyReq, req) {
        proxyReq.removeHeader('x-api-key');
        proxyReq.removeHeader('x-user-id');
        proxyReq.setHeader('x-api-key', apiKey);
        if (req.user) {
          proxyReq.setHeader('x-user-id', req.user.id);
        }
      },
      error(err, req, res) {
        if (res.headersSent) return;
        res.status(503).json({ success: false, message: `${name} service tidak tersedia` });
      }
    }
  });
}

const authProxy = makeProxy('Auth', process.env.AUTH_URL, process.env.AUTH_API_KEY);
const catalogProxy = makeProxy('Katalog', process.env.CATALOG_URL, process.env.CATALOG_API_KEY);
const loanProxy = makeProxy('Loan', process.env.LOAN_URL, process.env.LOAN_API_KEY);

// [method, pola path, proxy, perlu JWT]
// PATCH /api/books/:id sengaja tidak ada: endpoint internal loan-service, dicekal di gateway.
const ROUTES = [
  ['POST', /^\/api\/auth\/login$/, authProxy, false],
  ['POST', /^\/api\/auth\/logout$/, authProxy, true],
  ['GET', /^\/api\/auth\/me$/, authProxy, true],
  ['GET', /^\/api\/users\/[^/]+$/, authProxy, true],
  ['GET', /^\/api\/books$/, catalogProxy, true],
  ['GET', /^\/api\/books\/[^/]+$/, catalogProxy, true],
  ['GET', /^\/api\/loans$/, loanProxy, true],
  ['POST', /^\/api\/loans$/, loanProxy, true],
  ['POST', /^\/api\/loans\/[^/]+\/return$/, loanProxy, true]
];

router.use((req, res, next) => {
  // Path tanpa query string supaya pola di ROUTES tetap sederhana.
  const path = req.path;

  for (const [method, pattern, proxy, needsJwt] of ROUTES) {
    if (req.method !== method || !pattern.test(path)) continue;
    if (needsJwt) {
      return verifyJwt(req, res, () => proxy(req, res, next));
    }
    return proxy(req, res, next);
  }

  return next();
});

module.exports = router;