# API Contract — Sistem Peminjaman Buku

Dokumen ini adalah kontrak API final. Seluruh isi diturunkan dari kode di `api-gateway`,
`auth-service`, `catalog-service`, dan `loan-service`.

## 1. Informasi Umum

### Base URL

| Layer | Base URL | Dipakai oleh |
|---|---|---|
| **api-gateway** (satu-satunya pintu frontend) | `http://localhost:3000` | Frontend, Postman |
| auth-service (internal) | `http://localhost:3003` | Gateway, loan-service |
| catalog-service (internal) | `http://localhost:3001` | Gateway, loan-service |
| loan-service (internal) | `http://localhost:3002` | Gateway |

Frontend hanya memanggil gateway. Direct call ke `:3001/:3002/:3003` tanpa `x-api-key` → `401`.

### Header

| Header | Wajib untuk | Keterangan |
|---|---|---|
| `Authorization: Bearer <jwt>` | Semua endpoint gateway kecuali `POST /api/auth/login` dan `GET /health` | JWT dari login, masa berlaku default 2 jam (`JWT_EXPIRES`) |
| `Content-Type: application/json` | Semua request yang punya body | Gateway meneruskan body mentah ke service |
| `x-api-key` | Semua endpoint internal (`:3001/:3002/:3003`) | Di-inject gateway; header dari browser dihapus dan diganti |
| `x-user-id` | Tidak dikirim client | Di-inject gateway dari klaim `sub` JWT |

### Format respons

Semua respons berbentuk JSON dengan field `success` (`true` / `false`).
Respons gagal selalu berbentuk:

```json
{ "success": false, "message": "Pesan kesalahan" }
```

### Status code umum (semua endpoint gateway yang butuh JWT)

| Status | Kondisi | `message` |
|---|---|---|
| `401` | Header `Authorization` tidak ada / bukan `Bearer` | `Token tidak ditemukan` |
| `401` | Token salah, rusak, atau kedaluwarsa | `Token tidak valid atau kedaluwarsa` |
| `401` | Token tanpa `jti` (terbitan lama) | `Token versi lama, silakan login ulang` |
| `401` | Token sudah logout (jti di-revoke) | `Token sudah logout, silakan login kembali` |
| `503` | Auth service mati / timeout saat cek revoke (fail-closed) | `Auth service tidak tersedia` |
| `503` | Service tujuan mati / timeout proxy (10 detik) | `Auth service tidak tersedia` / `Katalog service tidak tersedia` / `Loan service tidak tersedia` |
| `404` | Route tidak dikenal (termasuk `PATCH /api/books/:id`, diblokir di gateway) | `Endpoint tidak ditemukan` |

### Data contoh (seed)

| Tipe | Data |
|---|---|
| User | `MHS001` Ahmad Fadil, `MHS002` Budi Santoso, `MHS003` Citra Dewi — password semua `123456` |
| Buku | `B001`–`B012`, status awal `available` (mis. `B001` Pemrograman Web, `B002` Basis Data) |

---

## 2. Endpoint Gateway (`http://localhost:3000`)

Ringkasan:

| Method | Path | Auth | Tujuan |
|---|---|---|---|
| GET | `/health` | — | Cek kesehatan gateway + 3 service |
| POST | `/api/auth/login` | — | Login, dapat JWT |
| POST | `/api/auth/logout` | Bearer | Revoke JWT |
| GET | `/api/auth/me` | Bearer | Profil dari JWT |
| GET | `/api/users/:id` | Bearer | Detail user (id, nama) |
| GET | `/api/books` | Bearer | Seluruh koleksi buku |
| GET | `/api/books/:id` | Bearer | Detail satu buku |
| GET | `/api/loans` | Bearer | Daftar peminjaman aktif |
| POST | `/api/loans` | Bearer | Pinjam buku |
| POST | `/api/loans/:id/return` | Bearer | Kembalikan buku |

### 2.1 `GET /health`

**Tujuan:** agregat cek `/health` ke auth, catalog, dan loan-service (timeout 3 detik per service).

- **Header:** tidak ada
- **Parameter / body:** tidak ada

**Status code**

| Status | Kondisi |
|---|---|
| `200` | Ketiga service sehat |
| `503` | Minimal satu service tidak sehat (`status: "degraded"`) |

**Validasi & business rule:** tidak ada validasi input; `success` bernilai `true` hanya jika semua service `ok`.

**Contoh berhasil — `200`**

```json
{
  "success": true,
  "service": "api-gateway",
  "status": "ok",
  "port": 3000,
  "services": {
    "auth": { "label": "Auth", "url": "http://localhost:3003", "ok": true,
              "detail": { "service": "auth-service", "status": "ok", "port": 3003 } },
    "catalog": { "label": "Katalog", "url": "http://localhost:3001", "ok": true,
                 "detail": { "service": "catalog-service", "status": "ok", "port": 3001 } },
    "loan": { "label": "Loan", "url": "http://localhost:3002", "ok": true,
              "detail": { "service": "loan-service", "status": "ok", "port": 3002 } }
  }
}
```

**Contoh gagal — `503`** (catalog-service mati)

```json
{
  "success": false,
  "service": "api-gateway",
  "status": "degraded",
  "port": 3000,
  "services": {
    "auth": { "label": "Auth", "url": "http://localhost:3003", "ok": true,
              "detail": { "service": "auth-service", "status": "ok", "port": 3003 } },
    "catalog": { "label": "Katalog", "url": "http://localhost:3001", "ok": false,
                 "detail": "tidak dapat dihubungi" },
    "loan": { "label": "Loan", "url": "http://localhost:3002", "ok": true,
              "detail": { "service": "loan-service", "status": "ok", "port": 3002 } }
  }
}
```

---

### 2.2 `POST /api/auth/login`

**Tujuan:** autentikasi mahasiswa dengan NIM + password, mengembalikan JWT.

- **Header:** `Content-Type: application/json`
- **Query / path:** tidak ada
- **Body:**

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `nim` | string | ya | NIM = id user (mis. `MHS001`) |
| `password` | string | ya | Password plain text (dicocokkan dengan hash bcrypt) |

**Status code**

| Status | Kondisi | `message` |
|---|---|---|
| `200` | Login berhasil | — |
| `400` | `nim` atau `password` kosong | `NIM dan password harus diisi` |
| `401` | NIM tidak ada atau password salah | `NIM atau password salah` |
| `500` | Database auth tidak tersedia | `Database tidak tersedia` |
| `503` | Auth service tidak terjangkau dari gateway | `Auth service tidak tersedia` |

**Validasi & business rule**
- `nim` dan `password` wajib terisi.
- Pesan `401` sama untuk NIM tidak ada dan password salah (tidak membocorkan NIM mana yang valid).
- JWT berisi `sub` (NIM), `name`, `jti` (UUID unik per login), berlaku 2 jam secara default.

**Contoh berhasil — `200`**

Request:
```json
{ "nim": "MHS001", "password": "123456" }
```
Response:
```json
{
  "success": true,
  "user": { "id": "MHS001", "name": "Ahmad Fadil" },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Contoh gagal — `400`** (password tidak dikirim)

Request:
```json
{ "nim": "MHS001" }
```
Response:
```json
{ "success": false, "message": "NIM dan password harus diisi" }
```

**Contoh gagal — `401`** (password salah)

Request:
```json
{ "nim": "MHS001", "password": "salah" }
```
Response:
```json
{ "success": false, "message": "NIM atau password salah" }
```

---

### 2.3 `POST /api/auth/logout`

**Tujuan:** me-revoke JWT yang sedang dipakai (blacklist `jti`), sehingga token ditolak di semua endpoint.

- **Header:** `Authorization: Bearer <jwt>`
- **Query / path / body:** tidak ada

**Status code**

| Status | Kondisi | `message` |
|---|---|---|
| `200` | Logout berhasil | `Logout berhasil` |
| `401` | Token tidak ada / tidak valid / sudah logout | Lihat status umum |
| `503` | Database auth tidak tersedia | `Database tidak tersedia` |

**Validasi & business rule**
- Setelah logout, token yang sama langsung ditolak (`401`) di `/me`, `/books`, `/loans`, termasuk logout kedua kali.
- Revoke disimpan di `auth_db.revoked_tokens(jti, user_id, expires_at)`.

**Contoh berhasil — `200`**

```json
{ "success": true, "message": "Logout berhasil" }
```

**Contoh gagal — `401`** (logout kedua kali dengan token yang sama)

```json
{ "success": false, "message": "Token sudah logout, silakan login kembali" }
```

---

### 2.4 `GET /api/auth/me`

**Tujuan:** mengambil profil user dari klaim JWT (tanpa query DB).

- **Header:** `Authorization: Bearer <jwt>`
- **Query / path / body:** tidak ada

**Status code**

| Status | Kondisi |
|---|---|
| `200` | Token valid |
| `401` | Token tidak ada / tidak valid / sudah logout (lihat status umum) |
| `503` | Auth service tidak tersedia |

**Validasi & business rule:** data diambil dari klaim `sub` dan `name`, bukan dari database.

**Contoh berhasil — `200`**

```json
{ "success": true, "user": { "id": "MHS001", "name": "Ahmad Fadil" } }
```

**Contoh gagal — `401`** (header `Authorization` tidak dikirim)

```json
{ "success": false, "message": "Token tidak ditemukan" }
```

---

### 2.5 `GET /api/users/:id`

**Tujuan:** mengambil detail user (tanpa password).

- **Header:** `Authorization: Bearer <jwt>`
- **Path:** `id` — id user, mis. `MHS001`
- **Query / body:** tidak ada

**Status code**

| Status | Kondisi | `message` |
|---|---|---|
| `200` | User ditemukan | — |
| `401` | Token bermasalah | Lihat status umum |
| `404` | User tidak ada | `User tidak ditemukan` |
| `500` | Database auth tidak tersedia | `Database tidak tersedia` |
| `503` | Auth service tidak tersedia | `Auth service tidak tersedia` |

**Validasi & business rule:** hanya `id` dan `name` yang dikembalikan; `password_hash` tidak pernah keluar.

**Contoh berhasil — `200`** (`GET /api/users/MHS002`)

```json
{ "success": true, "user": { "id": "MHS002", "name": "Budi Santoso" } }
```

**Contoh gagal — `404`** (`GET /api/users/MHS999`)

```json
{ "success": false, "message": "User tidak ditemukan" }
```

---

### 2.6 `GET /api/books`

**Tujuan:** menampilkan seluruh koleksi buku beserta status ketersediaan.

- **Header:** `Authorization: Bearer <jwt>`
- **Query / path / body:** tidak ada

**Status code**

| Status | Kondisi | `message` |
|---|---|---|
| `200` | Berhasil | — |
| `401` | Token bermasalah | Lihat status umum |
| `500` | Database katalog tidak tersedia | `Database tidak tersedia` |
| `503` | Katalog service tidak tersedia | `Katalog service tidak tersedia` |

**Validasi & business rule:** urut berdasarkan `id`; `status` hanya `available` atau `borrowed`.

**Contoh berhasil — `200`**

```json
{
  "success": true,
  "books": [
    { "id": "B001", "title": "Pemrograman Web", "author": "Andi Setiawan", "category": "Pemrograman", "status": "available" },
    { "id": "B002", "title": "Basis Data", "author": "Rina Wati", "category": "Basis Data", "status": "available" }
  ]
}
```

**Contoh gagal — `401`** (token kedaluwarsa atau rusak)

```json
{ "success": false, "message": "Token tidak valid atau kedaluwarsa" }
```

---

### 2.7 `GET /api/books/:id`

**Tujuan:** detail satu buku.

- **Header:** `Authorization: Bearer <jwt>`
- **Path:** `id` — id buku, mis. `B001`
- **Query / body:** tidak ada

**Status code**

| Status | Kondisi | `message` |
|---|---|---|
| `200` | Buku ditemukan | — |
| `401` | Token bermasalah | Lihat status umum |
| `404` | Buku tidak ada | `Buku tidak ditemukan` |
| `500` | Database katalog tidak tersedia | `Database tidak tersedia` |
| `503` | Katalog service tidak tersedia | `Katalog service tidak tersedia` |

**Validasi & business rule:** tidak ada validasi format `id`; id yang tidak terdaftar menghasilkan `404`.

**Contoh berhasil — `200`** (`GET /api/books/B001`)

```json
{
  "success": true,
  "book": { "id": "B001", "title": "Pemrograman Web", "author": "Andi Setiawan", "category": "Pemrograman", "status": "available" }
}
```

**Contoh gagal — `404`** (`GET /api/books/B999`)

```json
{ "success": false, "message": "Buku tidak ditemukan" }
```

---

### 2.8 `POST /api/loans`

**Tujuan:** meminjam buku.

- **Header:** `Authorization: Bearer <jwt>`, `Content-Type: application/json`
- **Query / path:** tidak ada
- **Body:**

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `studentId` | string | ya | NIM peminjam (mis. `MHS001`) |
| `bookId` | string | ya | Id buku (mis. `B001`) |

**Status code**

| Status | Kondisi | `message` |
|---|---|---|
| `201` | Peminjaman berhasil | — |
| `400` | `studentId` atau `bookId` kosong | `studentId dan bookId harus diisi` |
| `400` | Peminjam sudah punya 3 pinjaman aktif | `Batas maksimal peminjaman (3 buku) telah tercapai` |
| `401` | Token bermasalah | Lihat status umum |
| `404` | User tidak ditemukan di auth-service | `User tidak ditemukan` |
| `404` | Buku tidak ditemukan di katalog | `Buku tidak ditemukan` |
| `409` | Status buku bukan `available` | `Buku sedang dipinjam oleh pengguna lain` |
| `500` | Database loan tidak tersedia | `Database tidak tersedia` |
| `503` | Auth/katalog mati atau timeout (5 detik), atau update status buku gagal (loan di-rollback) | `Auth service tidak tersedia` / `Auth service timeout, coba lagi` / `Katalog service tidak tersedia` / `Katalog service timeout, coba lagi` |

**Validasi & business rule**
1. `studentId` dan `bookId` wajib ada.
2. User divalidasi lewat auth-service (`GET /api/users/:id`).
3. Buku divalidasi lewat catalog-service; hanya buku berstatus `available` yang boleh dipinjam.
4. Maksimal **3 pinjaman aktif** per `studentId` (pinjaman yang sudah dikembalikan dihapus, jadi tidak dihitung).
5. `borrowDate` = tanggal hari ini (UTC, `YYYY-MM-DD`); `dueDate` = `borrowDate` + **7 hari**.
6. Setelah loan tersimpan, status buku diubah ke `borrowed` lewat catalog-service. Jika gagal, loan dihapus (rollback) dan respons `503`, sehingga tidak ada loan yatim.
7. Urutan pengecekan: field wajib → user → buku ada → buku `available` → kuota.

**Contoh berhasil — `201`**

Request:
```json
{ "studentId": "MHS001", "bookId": "B001" }
```
Response:
```json
{
  "success": true,
  "loan": {
    "id": "LN_1792541520000_482",
    "studentId": "MHS001",
    "bookId": "B001",
    "borrowDate": "2026-10-21",
    "dueDate": "2026-10-28"
  }
}
```

**Contoh gagal — `400`** (`bookId` tidak dikirim)

Request:
```json
{ "studentId": "MHS001" }
```
Response:
```json
{ "success": false, "message": "studentId dan bookId harus diisi" }
```

**Contoh gagal — `400`** (`MHS001` sudah punya 3 pinjaman aktif)

Request:
```json
{ "studentId": "MHS001", "bookId": "B004" }
```
Response:
```json
{ "success": false, "message": "Batas maksimal peminjaman (3 buku) telah tercapai" }
```

**Contoh gagal — `404`** (NIM tidak terdaftar)

Request:
```json
{ "studentId": "MHS999", "bookId": "B001" }
```
Response:
```json
{ "success": false, "message": "User tidak ditemukan" }
```

**Contoh gagal — `404`** (id buku tidak ada)

Request:
```json
{ "studentId": "MHS001", "bookId": "B999" }
```
Response:
```json
{ "success": false, "message": "Buku tidak ditemukan" }
```

**Contoh gagal — `409`** (`B001` sedang dipinjam user lain)

Request:
```json
{ "studentId": "MHS002", "bookId": "B001" }
```
Response:
```json
{ "success": false, "message": "Buku sedang dipinjam oleh pengguna lain" }
```

**Contoh gagal — `503`** (catalog-service mati; tidak ada loan yang tercatat)

Request:
```json
{ "studentId": "MHS001", "bookId": "B001" }
```
Response:
```json
{ "success": false, "message": "Katalog service tidak tersedia" }
```

---

### 2.9 `GET /api/loans`

**Tujuan:** menampilkan daftar peminjaman aktif beserta judul buku.

- **Header:** `Authorization: Bearer <jwt>`
- **Query:**

| Parameter | Wajib | Keterangan |
|---|---|---|
| `studentId` | tidak | Jika diisi, hanya pinjaman milik NIM tersebut; jika kosong, semua pinjaman aktif |

- **Path / body:** tidak ada

**Status code**

| Status | Kondisi | `message` |
|---|---|---|
| `200` | Berhasil (daftar bisa kosong) | — |
| `401` | Token bermasalah | Lihat status umum |
| `500` | Database loan tidak tersedia | `Database tidak tersedia` |
| `503` | Katalog mati/timeout saat mengambil judul | `Katalog service tidak tersedia` / `Katalog service timeout, coba lagi` |

**Validasi & business rule**
- Urut berdasarkan `borrowDate`, lalu `id`.
- Setiap item diperkaya dengan `title` dari katalog; `title` bernilai `null` jika buku sudah tidak ada di katalog.
- Hanya pinjaman aktif yang ada di daftar (pinjaman yang dikembalikan dihapus dari tabel).

**Contoh berhasil — `200`** (`GET /api/loans?studentId=MHS001`)

```json
{
  "success": true,
  "loans": [
    {
      "id": "LN_1792541520000_482",
      "studentId": "MHS001",
      "bookId": "B001",
      "borrowDate": "2026-10-21",
      "dueDate": "2026-10-28",
      "title": "Pemrograman Web"
    }
  ]
}
```

Contoh berhasil, belum ada pinjaman — `200`:
```json
{ "success": true, "loans": [] }
```

**Contoh gagal — `503`** (catalog-service mati saat mengambil judul)

```json
{ "success": false, "message": "Katalog service tidak tersedia" }
```

---

### 2.10 `POST /api/loans/:id/return`

**Tujuan:** mengembalikan buku yang sedang dipinjam.

- **Header:** `Authorization: Bearer <jwt>`
- **Path:** `id` — id loan hasil `POST /api/loans` (mis. `LN_1792541520000_482`)
- **Query / body:** tidak ada

**Status code**

| Status | Kondisi | `message` |
|---|---|---|
| `200` | Pengembalian berhasil | `Buku berhasil dikembalikan` |
| `401` | Token bermasalah | Lihat status umum |
| `404` | Loan tidak ditemukan | `Data peminjaman tidak ditemukan` |
| `500` | Database loan tidak tersedia | `Database tidak tersedia` |
| `503` | Update status buku gagal (loan dipulihkan kembali) | `Katalog service tidak tersedia` / `Katalog service timeout, coba lagi` |

**Validasi & business rule**
1. Loan dicari berdasarkan `id`; tidak ada → `404`.
2. Loan dihapus dari `loan_db.loans`, lalu status buku diubah ke `available` lewat catalog-service.
3. Jika update status buku gagal, loan dimasukkan kembali (rollback) dan respons `503`.
4. Setelah berhasil, loan tidak muncul lagi di `GET /api/loans` dan kuota 3 buku peminjam berkurang satu.

**Contoh berhasil — `200`**

```json
{ "success": true, "message": "Buku berhasil dikembalikan" }
```

**Contoh gagal — `404`** (`POST /api/loans/LN_0_0/return`, id tidak ada)

```json
{ "success": false, "message": "Data peminjaman tidak ditemukan" }
```

**Contoh gagal — `503`** (catalog-service mati; loan dipulihkan, buku tetap `borrowed`)

```json
{ "success": false, "message": "Katalog service tidak tersedia" }
```

---

## 3. Endpoint Internal (antar service)

Hanya untuk komunikasi server-to-server. Semua wajib `x-api-key` milik service tujuan.
Tanpa key / key salah:

```json
{ "success": false, "message": "Unauthorized: x-api-key tidak valid" }
```
dengan status `401`. Kecuali `GET /health`, yang tidak butuh key.

| Method | URL | Tujuan | Dipanggil oleh |
|---|---|---|---|
| GET | `:3003/api/internal/sessions/check?jti=` | Cek apakah JWT sudah di-revoke | Gateway |
| GET | `:3003/api/users/:id` | Detail user | Gateway, loan-service |
| GET | `:3001/api/books` | Daftar buku | Gateway |
| GET | `:3001/api/books/:id` | Detail buku | Gateway, loan-service |
| PATCH | `:3001/api/books/:id` | Ubah status buku | **Hanya** loan-service |
| GET | `:3001/health`, `:3002/health`, `:3003/health` | Health tiap service | Gateway |

### 3.1 `GET :3003/api/internal/sessions/check?jti=<jti>`

- **Header:** `x-api-key` (auth-service)
- **Query:** `jti` — wajib, jti dari JWT

| Status | Kondisi | `message` |
|---|---|---|
| `200` | Berhasil | — |
| `400` | `jti` kosong | `jti harus diisi` |
| `401` | `x-api-key` tidak valid | `Unauthorized: x-api-key tidak valid` |
| `503` | Database auth tidak tersedia | `Database tidak tersedia` |

**Contoh berhasil — `200`**
```json
{ "success": true, "revoked": false }
```

**Contoh gagal — `400`** (`GET :3003/api/internal/sessions/check` tanpa `jti`)

```json
{ "success": false, "message": "jti harus diisi" }
```

**Contoh gagal — `401`** (`x-api-key` salah atau tidak dikirim; berlaku sama untuk semua endpoint internal)

```json
{ "success": false, "message": "Unauthorized: x-api-key tidak valid" }
```

### 3.2 `GET :3003/api/users/:id`

- **Header:** `x-api-key` (auth-service)
- **Path:** `id` — id user

| Status | Kondisi | `message` |
|---|---|---|
| `200` | User ditemukan | — |
| `401` | `x-api-key` tidak valid | `Unauthorized: x-api-key tidak valid` |
| `404` | User tidak ada | `User tidak ditemukan` |
| `500` | Database tidak tersedia | `Database tidak tersedia` |

**Contoh berhasil — `200`**
```json
{ "success": true, "user": { "id": "MHS001", "name": "Ahmad Fadil" } }
```

**Contoh gagal — `404`** (`GET :3003/api/users/MHS999`)

```json
{ "success": false, "message": "User tidak ditemukan" }
```

### 3.3 `GET :3001/api/books` dan `GET :3001/api/books/:id`

- **Header:** `x-api-key` (catalog-service)
- **Path (detail):** `id` — id buku

Status dan bentuk respons sama dengan [2.6](#26-get-apibooks) dan [2.7](#27-get-apibooksid), ditambah `401` bila `x-api-key` tidak valid.

### 3.4 `PATCH :3001/api/books/:id`

**Tujuan:** mengubah status buku; hanya dipakai loan-service saat pinjam (`borrowed`) dan kembali (`available`). Diblokir di gateway (`404`).

- **Header:** `x-api-key` (catalog-service), `Content-Type: application/json`
- **Path:** `id` — id buku
- **Body:**

| Field | Tipe | Wajib | Nilai |
|---|---|---|---|
| `status` | string | ya | `available` atau `borrowed` |

| Status | Kondisi | `message` |
|---|---|---|
| `200` | Status berhasil diubah | — |
| `400` | `status` kosong | `Status harus diisi` |
| `400` | `status` bukan nilai yang valid | `Status harus salah satu dari: available, borrowed` |
| `401` | `x-api-key` tidak valid | `Unauthorized: x-api-key tidak valid` |
| `404` | Buku tidak ada | `Buku tidak ditemukan` |
| `500` | Database tidak tersedia | `Database tidak tersedia` |

**Contoh berhasil — `200`**

Request:
```json
{ "status": "borrowed" }
```
Response:
```json
{
  "success": true,
  "book": { "id": "B001", "title": "Pemrograman Web", "author": "Andi Setiawan", "category": "Pemrograman", "status": "borrowed" }
}
```

**Contoh gagal — `400`** (body `{ "status": "hilang" }`)

```json
{ "success": false, "message": "Status harus salah satu dari: available, borrowed" }
```

**Contoh gagal — `400`** (body kosong)

```json
{ "success": false, "message": "Status harus diisi" }
```

**Contoh gagal — `404`** (`PATCH :3001/api/books/B999`)

```json
{ "success": false, "message": "Buku tidak ditemukan" }
```

### 3.5 `GET /health` (tiap service)

- **Header:** tidak ada

**Contoh berhasil — `200`** (`GET :3002/health`)
```json
{ "service": "loan-service", "status": "ok", "port": 3002 }
```

---

## 4. Catatan & Keterbatasan

- **Identitas peminjam belum dicocokkan dengan JWT.** `studentId` pada `POST /api/loans` (body) dan `GET /api/loans` (query) dipakai apa adanya oleh loan-service, sedangkan `x-user-id` yang di-inject gateway belum dibaca. Akibatnya `GET /api/loans` tanpa `studentId` mengembalikan semua pinjaman, dan `POST /api/loans/:id/return` tidak mengecek pemilik loan. Perbaikan lanjutan: pakai `x-user-id` sebagai identitas peminjam.
- **Race condition:** dua peminjam bersamaan untuk buku yang sama (check-then-act tanpa lock) belum ditangani.
- `borrowDate` dan `dueDate` memakai tanggal UTC.