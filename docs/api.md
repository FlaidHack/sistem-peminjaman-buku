# Daftar Endpoint API

Satu-satunya pintu frontend adalah `api-gateway` (`http://localhost:3000`).
Direct ke `:3001/:3002/:3003` tanpa `x-api-key` → `401`.
`PATCH /api/books/:id` internal saja, diblokir di gateway → `404`.

Auth: `POST /api/auth/login` tanpa token, sisanya pakai `Authorization: Bearer {{jwt}}`
(`{{studentId}}=MHS001`, `{{bookId}}=B001`, `{{loanId}}` dari hasil pinjam).

## Gateway — publik (`:3000`)

| Method & Path | Auth | Request |
|---|---|---|
| `GET /health` | — | — |
| `POST /api/auth/login` | — | Body: `{ "nim": "MHS001", "password": "123456" }` |
| `POST /api/auth/logout` | Bearer JWT | Header: `Authorization: Bearer {{jwt}}` |
| `GET /api/auth/me` | Bearer JWT | Header: `Authorization: Bearer {{jwt}}` |
| `GET /api/users/:id` | Bearer JWT | Path: `:id = MHS001` + header `Bearer {{jwt}}` |
| `GET /api/books` | Bearer JWT | Header: `Bearer {{jwt}}` |
| `GET /api/books/:id` | Bearer JWT | Path: `:id = B001` + header `Bearer {{jwt}}` |
| `GET /api/loans?studentId={{studentId}}` | Bearer JWT | Query: `studentId=MHS001` + header `Bearer {{jwt}}` |
| `POST /api/loans` | Bearer JWT | Header `Bearer {{jwt}}` + body `{ "studentId": "MHS001", "bookId": "B001" }` |
| `POST /api/loans/:id/return` | Bearer JWT | Path: `:id = {{loanId}}` + header `Bearer {{jwt}}` |

## Internal — antar service (direct + `x-api-key`)

| Method & Path | Auth | Request |
|---|---|---|
| `GET :3003/api/internal/sessions/check?jti=` | `x-api-key` (auth) | Query: `jti=<jti dari JWT>` |
| `GET :3003/api/users/:id` | `x-api-key` (auth) | Path: `:id = MHS001` |
| `GET :3001/api/books` | `x-api-key` (catalog) | — |
| `GET :3001/api/books/:id` | `x-api-key` (catalog) | Path: `:id = B001` |
| `PATCH :3001/api/books/:id` | `x-api-key` (catalog, internal loan-service) | Path `:id = B001` + body `{ "status": "borrowed" / "available" }` |
| `GET :3001/health`, `GET :3002/health`, `GET :3003/health` | — | — |
