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

- **Backend:** Node.js + Express.js
- **Frontend:** HTML, CSS, JavaScript (statis)
- **Penyimpanan:** File JSON per service
- **Komunikasi antar-service:** HTTP REST API (`fetch`)

## Microservice

Dua service backend yang berjalan terpisah dan berkomunikasi via HTTP:

- **catalog-service (:3001)** — autentikasi/login, katalog buku, dan data pengguna.
- **loan-service (:3002)** — sirkulasi peminjaman: pinjam, daftar pinjaman aktif, dan pengembalian. Tidak membaca data service lain secara langsung; semua validasi lewat catalog-service.

> Lihat detail: [dokumentasi arsitektur](docs/architecture.md)

## Penggunaan AI

AI coding tool yang digunakan selama pengembangan adalah **Opencode**. AI berperan dalam
perencanaan migrasi dari arsitektur monolitik ke microservice, pembangunan catalog-service dan
loan-service, integrasi antar service, adaptasi serta redesign frontend agar memakai API dari
service, debugging bug (misalnya web blank/double refresh akibat masalah live server), hingga
bantuan penyusunan dokumentasi.

> Lihat detail: [dokumentasi penggunaan AI](docs/ai.md)

## Alur Sistem

1. User login ke **catalog-service** → mendapat data pengguna.
2. User melihat daftar buku dari **catalog-service**.
3. User mengajukan peminjaman ke **loan-service**.
4. **loan-service** memvalidasi ke **catalog-service** (user ada? buku tersedia? kuota < 3?).
5. Jika valid, **loan-service** mencatat pinjaman dan mengubah status buku menjadi `borrowed` di **catalog-service** (lewat HTTP, dengan key internal).
6. Pada pengembalian, **loan-service** menghapus pinjaman dan mengubah status buku kembali menjadi `available`.
7. Jika komunikasi antar-service gagal, sistem melakukan rollback dan mengembalikan pesan error.

## Cara menjalankan

Arsitektur microservice: 2 backend (Express) + 1 frontend statis.

### 1. Backend — catalog-service (:3001)

```powershell
cd catalog-service
npm install   # sekali saja
node server.js
```

### 2. Backend — loan-service (:3002)

```powershell
cd loan-service
npm install   # sekali saja
node server.js
```

`catalog-service` harus jalan sebelum `loan-service` dipakai (S2 memanggil S1 tiap transaksi).
Cek sehat: `http://localhost:3001/health` dan `http://localhost:3002/health`.

### 3. Frontend — dari folder `frontend/` (bukan root repo)

```powershell
# opsi A: VS Code Live Server → klik kanan frontend/index.html → Open with Live Server
# opsi B:
npx serve frontend
```

Lalu buka URL-nya di browser dan login (misal NIM `MHS001`, password `123456`).

> Penting: serve dari `frontend/`, jangan dari root repo. File `data/*.json`
> di `catalog-service/`/`loan-service/` berubah setiap ada aksi pinjam/kembalikan,
> sehingga dev server yang root-nya repo (mis. Live Server dari root) akan
> me-reload halaman setiap transaksi.
