Sistem peminjaman buku ayo masuk nama ku
Sistem peminjaman buku kelompok 1

kristanto cahyo nugroho
muhammad fadil
reyhan samudra
alfatir faza
khairunisa

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
