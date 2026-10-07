# Arsitektur Sistem Peminjaman Buku

Dokumentasi ini menjelaskan perjalanan arsitektur sistem: mulai dari **arsitektur monolitik**
(sebelum dikembangkan) hingga **arsitektur microservice** (kondisi saat ini).

## 1. Arsitektur Sebelum — Monolitik

Pada tahap awal, aplikasi hanya berupa **satu halaman web statis** yang disusun dari tiga file
yang berada di root proyek:

- `index.html` — struktur dan tampilan antarmuka (halaman login, katalog buku, dan peminjaman aktif).
- `style.css` — styling/desain antarmuka.
- `script.js` — seluruh logika aplikasi: login, katalog, peminjaman, pengembalian, hingga data.

Tidak ada backend, tidak ada API, dan tidak ada pemisahan layanan. Semua data disimpan di
**localStorage** browser (key `users`, `books`, `loans`, `session`), dengan seed data
(pengguna & buku) yang ditulis langsung (hardcoded) di dalam `script.js`. Validasi aturan
bisnis (maksimal 3 pinjaman aktif, jatuh tempo +7 hari, buku yang dipinjam tidak tersedia)
juga dilakukan sepenuhnya di sisi klien.

```mermaid
flowchart TB
    B["Browser — satu halaman statis"]
    B --> HTML["index.html — struktur & UI"]
    B --> CSS["style.css — styling"]
    B --> JS["script.js — seluruh logika aplikasi"]
    JS --> LS[("localStorage (browser)<br/>users · books · loans · session")]
```

| Karakteristik | Keterangan |
|---------------|------------|
| Struktur | 3 file statis (HTML, CSS, JS) di root |
| Penyimpanan data | `localStorage` browser |
| Logika bisnis | Di dalam `script.js` (client-side) |
| Backend / API | Tidak ada |
| Skalabilitas | Rendah — semua dalam satu bundle |

## 2. Arsitektur Sesudah — Microservice

Untuk mengatasi keterbatasan arsitektur monolitik, sistem dikembangkan menjadi arsitektur
**microservice**: dua service backend yang terpisah dan berkomunikasi lewat HTTP REST API,
dengan frontend statis yang mengonsumsi API dari service tersebut.

### Diagram Arsitektur Microservice

```mermaid
flowchart TB
    subgraph FE["FRONTEND — statis"]
        UI["frontend/<br/>index.html · style.css · script.js"]
    end

    subgraph BE["BACKEND — microservice (Node.js + Express)"]
        CAT["catalog-service :3001<br/>data/users.json · data/books.json"]
        LOAN["loan-service :3002<br/>data/loans.json"]
    end

    UI -- "HTTP :3001 — login · katalog" --> CAT
    UI -- "HTTP :3002 — pinjam · aktif · kembali" --> LOAN
    LOAN -- "validasi via catalogClient.js (timeout 5 detik)<br/>GET /api/users/:id · GET /api/books/:id<br/>PATCH /api/books/:id (header x-internal-key)" --> CAT
```

| Bagian | Teknologi | Port | Kepemilikan data |
|--------|-----------|------|------------------|
| `frontend/` | HTML, CSS, JavaScript (statis) | via Live Server / `npx serve` | — |
| `catalog-service` | Node.js + Express | 3001 | `data/users.json`, `data/books.json` |
| `loan-service` | Node.js + Express | 3002 | `data/loans.json` |

Perbedaan utama dengan arsitektur sebelumnya:

- Data berpindah dari `localStorage` browser ke **file JSON per service**.
- Setiap service memiliki data dan tanggung jawabnya sendiri (**data terisolasi**).
- Komunikasi antar-service dilakukan lewat HTTP API, bukan akses file langsung.
- Validasi aturan bisnis dipindahkan ke sisi **server** (`loan-service`).

## 3. Detail Microservice

Dua service, komunikasi antar-service lewat HTTP API. Data terisolasi per service (file JSON
masing-masing) — lihat diagram arsitektur di [bagian 2](#2-arsitektur-sesudah--microservice).

* **catalog-service (:3001)** — owner `users.json` + `books.json`. Endpoint: `POST /api/login`,
  `GET /api/books`, `GET /api/books/:id`, `GET /api/users/:id`,
  `PATCH /api/books/:id` (dikunci header `x-internal-key`, hanya untuk loan-service).
* **loan-service (:3002)** — owner `loans.json`. Tidak pernah membaca `users.json`/`books.json`
  langsung; semua validasi via `services/catalogClient.js` (`fetch` ke S1, timeout 5 detik
  via `AbortSignal.timeout`, bisa dioverride dengan env `CATALOG_TIMEOUT_MS`).
  Endpoint: `POST /api/loans`, `GET /api/loans?studentId=`, `POST /api/loans/:id/return`.
* Aturan bisnis (di S2): maks 3 pinjaman aktif (`400`), buku `borrowed` ditolak (`409`),
  jatuh tempo +7 hari. Gagal hubungi S1 → `503` (pesan dibedakan: "tidak tersedia" vs "timeout").
  Jika PATCH status buku gagal setelah loan ditulis/dihapus, S2 rollback (hapus/kembalikan loan).

## 4. Alur pinjam (sequence)

1. `POST :3002/api/loans {studentId, bookId}`
2. S2 → `GET :3001/api/users/{id}` (user ada?)
3. S2 → `GET :3001/api/books/{id}` (status `available`? kuota < 3?)
4. S2 tulis loan ke `loans.json`, lalu → `PATCH :3001/api/books/{id} {borrowed}`
5. PATCH gagal → loan dihapus lagi (rollback) + `503`

Alur return analog: hapus loan dulu, PATCH `available`, gagal → loan dikembalikan + `503`.

## 5. Bukti uji Tahap 3 (2026-09-21)

| # | Uji | Hasil |
|---|-----|-------|
| 3A | `grep users.json\|books.json` di `loan-service/*.js` | bersih (hanya komentar) |
| 3B | login MHS001 → pinjam B001 → `GET /books/B001` | `available` → `borrowed`, `dueDate` +7 hari (21→28 Sep 2026) |
| 3B | `GET /loans?studentId=MHS001` | 1 loan + `title: Pemrograman Web` (enrich via S1) |
| 3B | return → cek ulang | B001 `available`, loans kosong |
| 3C | S1 dimatikan, `POST /loans` | `503 Katalog service tidak tersedia`, `loans.json` tetap `[]` |
| 3C | PATCH digagalkan (key salah), `POST /loans` | `503`, loan ter-rollback, buku tetap `available` |
| 3C | `PATCH /books/:id` tanpa/salah key | `403` |
| 3C | S1 di-hang, timeout 800ms/2000ms | `TimeoutError` ~817ms; e2e `503 Katalog service timeout, coba lagi` |

Keterbatasan yang diketahui: race condition dua peminjam bersamaan untuk buku yang sama
(check-then-act tanpa lock) — di luar scope, cukup didokumentasikan.

## 6. Arsitektur Akhir — Gateway + MySQL + JWT (Fase 4–6)

Tahap JSON-file (bagian 2–5) dimigrasikan ke **satu pintu api-gateway (`:3000`)**,
autentikasi **JWT (expiry 2 jam)**, proteksi antar-service via **`x-api-key`**,
dan penyimpanan **MySQL dengan DB-per-service** (1 server, 3 database).
Frontend (`frontend/script.js`) hanya kenal `gatewayBaseUrl: http://localhost:3000`
dan mengirim `Authorization: Bearer` tiap request kecuali login.

### Diagram Arsitektur Gateway

```mermaid
flowchart TB
    subgraph FE["FRONTEND — statis"]
        UI["frontend/<br/>index.html · style.css · script.js<br/>(hanya panggil :3000 + Bearer JWT)"]
    end

    subgraph GW["API-GATEWAY :3000"]
        VFY["verifyJwt + ROUTES<br/>inject x-user-id + x-api-key<br/>GET /health (agregat)"]
    end

    subgraph SVC["SERVICE (Node.js + Express)"]
        AUTH["auth-service :3003<br/>auth_db.users"]
        CAT["catalog-service :3001<br/>catalog_db.books"]
        LOAN["loan-service :3002<br/>loan_db.loans"]
    end

    subgraph DB["MYSQL — 1 server, DB-per-service"]
        ADB[("auth_db<br/>users")]
        CDB[("catalog_db<br/>books")]
        LDB[("loan_db<br/>loans")]
    end

    UI -- "HTTP :3000<br/>/api/auth/*, /api/books, /api/loans" --> VFY
    VFY -- "x-api-key AUTH_API_KEY" --> AUTH
    VFY -- "x-api-key CATALOG_API_KEY" --> CAT
    VFY -- "x-api-key LOAN_API_KEY" --> LOAN
    AUTH --- ADB
    CAT --- CDB
    LOAN --- LDB
    LOAN -- "validasi user (x-api-key)" --> AUTH
    LOAN -- "validasi + PATCH status buku (x-api-key)" --> CAT
```

| Bagian | Port | Kepemilikan data | Kunci akses |
|--------|------|------------------|-------------|
| `api-gateway` | 3000 | — (stateless, verify JWT) | `JWT_SECRET` + 3 API key |
| `auth-service` | 3003 | `auth_db.users` | `AUTH_API_KEY` + `JWT_SECRET` |
| `catalog-service` | 3001 | `catalog_db.books` | `CATALOG_API_KEY` |
| `loan-service` | 3002 | `loan_db.loans` | `LOAN_API_KEY` (+ key catalog/auth untuk panggil S1/S3) |
| `frontend/` | via Live Server / `npx serve` | — | Bearer JWT saja (tidak tahu API key) |

Aturan yang ditegakkan gateway (`api-gateway/routes/proxy.js`):
- Header `x-api-key`/`x-user-id` dari browser **dihapus lalu di-inject ulang** dari JWT
  yang terverifikasi (tidak bisa dipalsukan dari frontend).
- `PATCH /api/books/:id` **tidak diteruskan** (endpoint internal loan-service) → `404`.
- Direct call ke `:3001/:3002/:3003` tanpa `x-api-key` → `401`.

### DB-per-service

Satu server MySQL lokal (`localhost:3306, root, password kosong`), tiap service hanya
membuka **satu `DB_NAME`** miliknya (`auth-service/db.js` → `auth_db`, dst.).
Tidak ada join lintas DB dan tidak ada akses file/data service lain:
`loan-service` memvalidasi user & buku murni lewat HTTP ke auth/catalog-service.
Skema final terdefinisi di `auth-service/{schema,seed}.sql`,
`catalog-service/{schema,seed}.sql`, `loan-service/schema.sql` (diimport via phpMyAdmin).

### Catatan logout stateless (disepakati, keterbatasan diterima)

`POST /api/auth/logout` hanya formalitas `200`: **tanpa tabel blacklist**, sehingga
token curian/hasil login lama **tetap valid sampai expired (2 jam)**.
Bukti: request Postman `1-Auth / Me token lama setelah logout → 200 (stateless)`.
Mitigasi yang dipakai: expiry pendek 2 jam, `.env` (berisi `JWT_SECRET`/API key)
tidak di-commit, dan frontend selalu `clearSession()` lokal saat logout atau saat
menerima `401`. Ini disepakati sebagai keterbatasan proyek yang diterima.

### Verifikasi Fase 6

Pengujian sumber-kebenaran memakai Postman: `postman/Perpustakaan-Gateway.postman_collection.json`
(folder `0-Health`, `1-Auth`, `2-Catalog`, `3-Loans`, `4-Security negatif`, tiap request
ada `Tests` + `pm.environment.set("jwt"/"loanId")`) dengan environment `postman/Local.postman_environment.json`.
Uji wajib per laptop: `GET :3000/health` → login MHS001 → pinjam B001 (`borrowed`) →
return (`available`), plus simulasi catalog mati → `503` tanpa loan nyangkut.
Lihat [README](../README.md) (cara run 4 service + import Postman).