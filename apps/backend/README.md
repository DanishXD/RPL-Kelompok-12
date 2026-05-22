# EcoSmart Feeder — Backend API

## Prasyarat
- Node.js 20+
- Docker & Docker Compose
- Git

---

## Setup Awal (Lakukan Sekali)

### 1. Clone & masuk ke folder backend
```bash
cd ecosmart-feeder/apps/backend
```

### 2. Copy file environment
```bash
cp .env.example .env
```
Buka `.env` dan isi nilainya (terutama `JWT_SECRET`).

Generate JWT_SECRET yang aman:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Jalankan database lokal
```bash
# Dari folder root ecosmart-feeder/
docker compose up -d

# Cek semua service jalan
docker compose ps
```

### 4. Install dependencies
```bash
npm install
```

### 5. Generate & jalankan migrasi database
```bash
# Generate SQL migration dari schema
npm run db:generate

# Jalankan migration ke PostgreSQL
npm run db:migrate
```

---

## Menjalankan Server

```bash
# Mode development (auto-restart saat file berubah)
npm run dev
```

Server berjalan di: `http://localhost:3000`

---

## Test Endpoint di Postman / Thunder Client

### Register akun baru
```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "name": "Budi Suryanto",
  "email": "budi@example.com",
  "password": "Kolam123"
}
```

### Login
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "budi@example.com",
  "password": "Kolam123"
}
```

### Lihat profil (butuh token dari login)
```
GET http://localhost:3000/api/auth/me
Authorization: Bearer <accessToken dari response login>
```

### Refresh token
```
POST http://localhost:3000/api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refreshToken dari response login>"
}
```

### Logout
```
DELETE http://localhost:3000/api/auth/logout
Content-Type: application/json

{
  "refreshToken": "<refreshToken>"
}
```

### Health check
```
GET http://localhost:3000/health
```

---

## Struktur File

```
src/
├── app.ts                    ← Entry point, register semua plugin & route
├── plugins/
│   └── db.ts                 ← Koneksi PostgreSQL
└── modules/
    └── auth/
        ├── auth.routes.ts    ← Endpoint definitions
        ├── auth.service.ts   ← Business logic
        └── auth.schema.ts    ← Validasi input (Zod)
drizzle/
├── schema.ts                 ← Definisi tabel database
└── migrations/               ← File SQL migration
```

---

## Step Selanjutnya
Setelah auth berjalan, lanjut ke:
- **Step 3**: Halaman Login & Signup di mobile (React Native)
- **Step 4**: IoT data ingestion — MQTT + InfluxDB
