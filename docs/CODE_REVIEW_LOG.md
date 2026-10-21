# Code Review Log

Review atas kode Sistem Peminjaman Buku yang dibuat dengan bantuan AI (Opencode untuk eksekusi kode,
Claude untuk audit). Setiap temuan dicocokkan langsung dengan kode di repo, lalu diputuskan diperbaiki
atau didokumentasikan sebagai keterbatasan. Tanggal review: 21 Oktober 2026.

Aspek yang dipakai: Correctness, Readability, Maintainability, Coding Standard.

| No. | Bagian | Temuan | Perbaikan/Keputusan |
|---|---|---|---|
| 1 | `auth-service/routes/auth.js` (logout), `api-gateway/middleware/verifyJwt.js` | **Correctness:** JWT stateless, logout tidak mencabut token sehingga token lama tetap valid sampai 2 jam. | Login menerbitkan `jti`; logout menyimpan `jti` ke `revoked_tokens`; gateway dan `/me` menolak `jti` yang dicabut → 401. Bukti: Postman `Logout -> 200` lalu `Me token lama setelah logout -> 401 (revoked)`. |
| 2 | Autentikasi antar-service (catalog, loan, auth) | **Coding Standard:** satu internal key hardcoded (`x-internal-key`) di kode. | Diganti 3 API Key independen lewat `.env` dengan header `x-api-key`; key lama → 401. Bukti: tidak ada sisa `x-internal-key` di kode `.js`; Postman `Key lama x-internal-key -> 401`. |
| 3 | `loan-service/routes/loans.js` (`POST /loans`, baris 79–106) | **Correctness:** cek kuota dan status buku lalu tulis (check-then-act) tanpa lock, rawan race condition: dua peminjam bersamaan bisa meminjam buku yang sama. | Diputuskan di luar scope UTS dan didokumentasikan sebagai keterbatasan di `docs/ARCHITECTURE.md` dan `docs/PRD.md`. Perbaikan lanjutan: ubah status buku secara atomik (`UPDATE ... WHERE status='available'`) dan cek `affectedRows`. |
| 4 | `api-gateway/routes/proxy.js` | **Maintainability:** `PATCH /api/books/{id}` adalah endpoint internal loan-service. | Tidak diteruskan di gateway (→ 404); hanya loan-service yang boleh memanggil langsung dengan `x-api-key`. Bukti: Postman folder `4-Security negatif`, PATCH via gateway → 404. |
| 5 | `loan-service/routes/loans.js` (baris 52, 125, 152), `api-gateway/routes/proxy.js` (baris 25) | **Correctness (keamanan):** `studentId` dari body/query dipakai apa adanya (`POST` hanya memvalidasi user ada, bukan pemilik token), `x-user-id` hasil verifikasi JWT dari gateway tidak dibaca. Akibatnya user ber-JWT valid bisa meminjam, melihat, atau mengembalikan pinjaman atas nama `studentId` lain, `GET /loans` tanpa `studentId` mengembalikan semua loan, dan `POST /loans/:id/return` tidak mengecek pemilik loan. | Diputuskan sebagai keterbatasan UTS dan dicatat di `docs/PRD.md` (Risiko), `docs/ARCHITECTURE.md`, dan `docs/API_CONTRACT.md` §4. Perbaikan lanjutan: pakai `x-user-id` sebagai identitas peminjam, filter `GET` dan cek kepemilikan saat return berdasarkan `x-user-id`. |

## Ringkasan

- Diperbaiki di kode: temuan 1, 2, 4.
- Dicatat sebagai keterbatasan dengan rencana perbaikan: temuan 3 dan 5.
- Catatan: komentar `auth-service/routes/auth.js:82` sudah sesuai kode (logout kedua kali → 401); request Postman khusus logout ulang belum ada (opsional).
