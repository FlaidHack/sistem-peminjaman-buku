# Arsitektur Microservice — Sistem Peminjaman Buku

Dua service, komunikasi antar-service lewat HTTP API. Data terisolasi per service (file JSON masing-masing).

```
[Browser: index.html + script.js]
   | :3001 (login, katalog)      | :3002 (pinjam, aktif, kembali)
   v                             v
[catalog-service :3001] <---- GET/PATCH /api/books/*, GET /api/users/:id
data/users.json, data/books.json  ---- [loan-service :3002]
                                            data/loans.json
```

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

## Alur pinjam (sequence)

1. `POST :3002/api/loans {studentId, bookId}`
2. S2 → `GET :3001/api/users/{id}` (user ada?)
3. S2 → `GET :3001/api/books/{id}` (status `available`? kuota < 3?)
4. S2 tulis loan ke `loans.json`, lalu → `PATCH :3001/api/books/{id} {borrowed}`
5. PATCH gagal → loan dihapus lagi (rollback) + `503`

Alur return analog: hapus loan dulu, PATCH `available`, gagal → loan dikembalikan + `503`.

## Bukti uji Tahap 3 (2026-09-21)

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
