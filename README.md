# Sistem Peminjaman Buku

Sistem peminjaman buku kelompok 1.

Anggota kelompok:
- kristanto cahyo nugroho
- muhammad fadil
- reyhan samudra
- alfathir faza
- khairunisa

## Deskripsi

Aplikasi berbasis web untuk mengelola katalog dan peminjaman buku di perpustakaan.
Pengguna dapat login, melihat daftar buku, meminjam buku, dan mengembalikan buku dengan
aturan bisnis (maksimal 3 pinjaman aktif, jatuh tempo +7 hari, buku yang sedang dipinjam tidak tersedia).

## Teknologi yang Digunakan

- **Backend:** Node.js + Express.js (4 proses: api-gateway, auth-service, catalog-service, loan-service)
- **Auth:** JWT (expiry 2 jam) + API Key per service (`x-api-key`)
- **Database:** MySQL (1 server, 3 database: `auth_db`, `catalog_db`, `loan_db`)
- **Frontend:** HTML, CSS, JavaScript (statis, hanya memanggil api-gateway)
- **Pengujian:** Postman (`postman/`) — sumber kebenaran pengujian
- **Komunikasi antar-service:** HTTP REST API (`fetch`)

## Microservice

Empat proses backend + 1 frontend statis. **Satu-satunya pintu masuk adalah
api-gateway (`:3000`)** — frontend tidak pernah memanggil `:3001/:3002/:3003` langsung.

- **api-gateway (:3000)** — CORS, verifikasi Bearer JWT, inject `x-user-id` + `x-api-key` per tujuan, proxy ke service terkait, agregasi `GET /health`.
- **auth-service (:3003)** — owner `auth_db.users`. Endpoint: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/users/:id` (internal).
- **catalog-service (:3001)** — owner `catalog_db.books`. Endpoint: `GET /api/books`, `GET /api/books/:id`, `PATCH /api/books/:id` (internal, hanya untuk loan-service; **diblokir di gateway**).
- **loan-service (:3002)** — owner `loan_db.loans`. Tidak membaca DB service lain; validasi user via auth-service dan buku via catalog-service (HTTP + `x-api-key`, timeout 5 detik). Endpoint: `POST /api/loans`, `GET /api/loans?studentId=`, `POST /api/loans/:id/return`.
- Direct call ke `:3001/:3002/:3003` tanpa `x-api-key` → `401`.

> Lihat detail: [dokumentasi arsitektur](docs/architecture.md) — diagram gateway, DB-per-service, catatan logout stateless.

## Penggunaan AI

AI coding tool yang digunakan selama pengembangan adalah **Opencode**,**claude**. AI berperan dalam
perencanaan migrasi dari arsitektur monolitik ke microservice, pembangunan catalog-service dan
loan-service, integrasi antar service, adaptasi serta redesign frontend agar memakai API dari
service, debugging bug (misalnya web blank/double refresh akibat masalah live server), hingga
bantuan penyusunan dokumentasi.

> Lihat detail: [dokumentasi penggunaan AI](docs/ai.md)

## Alur Sistem

1. User login ke **api-gateway** → diteruskan ke **auth-service** → mendapat JWT (2 jam).
2. User melihat daftar buku: gateway (verify JWT) → **catalog-service**.
3. User mengajukan peminjaman: gateway → **loan-service**.
4. **loan-service** memvalidasi ke **auth-service** (user ada?) dan **catalog-service** (buku `available`? kuota < 3?).
5. Jika valid, **loan-service** mencatat pinjaman di `loan_db` dan mengubah status buku menjadi `borrowed` di **catalog-service** (lewat HTTP + `x-api-key`).
6. Pada pengembalian, **loan-service** menghapus pinjaman dan mengubah status buku kembali menjadi `available`.
7. Jika komunikasi antar-service gagal, sistem melakukan rollback dan mengembalikan pesan error (`503`).

## Cara menjalankan

Arsitektur akhir: 4 backend (Express) + 1 frontend statis + MySQL.

### 0. Prasyarat (tiap laptop)

- Node.js terinstal (`node --version` jalan).
- MySQL jalan (XAMPP/Laragon): `host=localhost, port=3306, user=root, password=(kosong)`.
- SQL sudah diimport via phpMyAdmin (urut: `auth-service/schema.sql` → `auth-service/seed.sql`, `catalog-service/schema.sql` → `catalog-service/seed.sql`, `loan-service/schema.sql`). Jika di laptop baru: import ulang dengan urutan yang sama.
- Salin tiap `.env.example` → `.env` lalu isi key/secret. **Minta 1 set seragam dari ketua** (`AUTH_API_KEY`, `CATALOG_API_KEY`, `LOAN_API_KEY`, `JWT_SECRET` harus sama di semua service + gateway); hanya `PORT`/`DB_NAME` yang beda per service.

### 1. Backend — auth-service (:3003)

```powershell
cd auth-service
npm install   # sekali saja
node server.js
```

### 2. Backend — catalog-service (:3001)

```powershell
cd catalog-service
npm install   # sekali saja
node server.js
```

### 3. Backend — loan-service (:3002)

```powershell
cd loan-service
npm install   # sekali saja
node server.js
```

### 4. Backend — api-gateway (:3000)

```powershell
cd api-gateway
npm install   # sekali saja
node server.js
```

Jalankan di **4 terminal terpisah** (atau 4 tab). Urutan start bebas, tapi semua
harus hidup sebelum dipakai. Cek sehat: `http://localhost:3000/health`
(agregat status `auth`, `catalog`, `loan` — semua harus `ok`, kalau tidak status `503 degraded`).

### 5. Frontend — dari folder `frontend/` (bukan root repo)

```powershell
# opsi A: VS Code Live Server → klik kanan frontend/index.html → Open with Live Server
# opsi B:
npx serve frontend
```

Lalu buka URL-nya di browser dan login (NIM `MHS001`, password `123456`).

> Penting: serve dari `frontend/`, jangan dari root repo.

## Pengujian dengan Postman (Fase 6)

Sumber kebenaran pengujian adalah Postman (`test.http` lama tidak dipakai).

### Import

1. Postman → **Import → Folder** → pilih folder `postman/` (collection + environment ikut masuk).
2. Pilih environment **Local** di kanan atas.
3. Kirim request **Login MHS001** dulu (mengisi variabel `jwt`), baru jalankan **Collection Runner dari atas ke bawah**.

Isi collection `Perpustakaan-Gateway`:
- `0-Health` — `GET /health` gateway (agregat 3 service).
- `1-Auth` — login ok/`401`/`400`, `me` tanpa token `401`, `me` + `logout` `200`, token lama setelah logout `401` (bukti logout stateful via `revoked_tokens`).
- `2-Catalog` — list + detail buku.
- `3-Loans` — pinjam `201` (isi `loanId`) → cek `borrowed` → list aktif → pinjam dobel `409` → `400`/`404` → return `200` → cek `available` → return lagi `404`.
- `4-Security negatif` — tanpa Bearer `401`, direct `:3001/:3002/:3003` tanpa `x-api-key` `401`, key lama `x-internal-key` `401`, PATCH via gateway `404`.

Setiap request sudah punya **Tests** (assert status + body); request Login menyimpan
`jwt`, request Pinjam menyimpan `loanId` via `pm.environment.set(...)`.

### Verifikasi wajib tiap laptop (checklist kelompok)

1. `GET :3000/health` → `200`, ketiga service `ok`.
2. Login `MHS001` / `123456` → `200 + token`.
3. Pinjam `B001` → `201`, lalu `GET /api/books/B001` → `borrowed`.
4. Return → `200`, lalu `GET /api/books/B001` → `available`.
5. Simulasi catalog mati (manual, di luar Runner):
   - Matikan proses `catalog-service`, kirim **Pinjam B001** → harus `503` dan **loan tidak tercatat** (cek `GET /api/loans?studentId=MHS001` tetap kosong setelah catalog dinyalakan lagi).
   - Nyalakan lagi `catalog-service`, ulangi pinjam → `201` normal.
6. Runner Postman dari atas ke bawah hijau semua.

> Acuan arsitektur: [docs/architecture.md](docs/architecture.md). Sumber kebenaran pengujian: collection Postman di `postman/`.
