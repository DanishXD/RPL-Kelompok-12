# 🐟 EcoSmart Feeder

Sistem monitoring dan pemberian pakan ikan otomatis berbasis IoT — menggabungkan ESP32, backend real-time, dan aplikasi mobile dengan AI Chatbot.

![Platform](https://img.shields.io/badge/Platform-ESP32%20%7C%20iOS%20%7C%20Android-blue)
![Stack](https://img.shields.io/badge/Stack-Fastify%20%7C%20React%20Native%20%7C%20InfluxDB-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 📱 Tampilan Aplikasi

| Dashboard | Monitoring | Kontrol | Alert |
|-----------|------------|---------|-------|
| Status sensor real-time | Grafik historis | Jadwal & manual feed | Notifikasi threshold |

---

## ✨ Fitur

- **Monitoring Real-time** — Suhu, pH air, level pakan, dan cahaya via WebSocket
- **Pemberian Pakan Otomatis** — Jadwal terjadwal + trigger manual dari app
- **Alert Cerdas** — Notifikasi lokal saat sensor melewati batas aman
- **AI Chatbot** — Tanya kondisi kolam ke AI berbasis data sensor langsung
- **Multi-device** — Satu akun bisa kelola banyak kolam sekaligus
- **Auth Aman** — JWT access token (15 menit) + refresh token (30 hari)

---

## 🏗️ Arsitektur

```
┌─────────────┐     MQTT      ┌──────────────────┐     WebSocket    ┌─────────────┐
│   ESP32     │ ────────────► │  Backend Fastify  │ ───────────────► │  Mobile App │
│  (Sensor)   │               │  + PostgreSQL     │                  │  (Expo RN)  │
└─────────────┘               │  + InfluxDB       │                  └─────────────┘
                               └──────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| Fastify | ^4.27 | HTTP & WebSocket server |
| PostgreSQL + Drizzle ORM | ^0.30 | Data user & device |
| InfluxDB | ^1.33 | Time-series data sensor |
| MQTT (Mosquitto) | ^5.5 | Komunikasi ESP32 → Backend |
| Socket.io | ^4.7 | Real-time push ke mobile |
| JWT | — | Autentikasi user |
| Zod | ^3.23 | Validasi request |

### Mobile
| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| React Native + Expo | SDK 52 | Framework mobile |
| Expo Router | ~4.0 | File-based navigation |
| Zustand | ^4.5 | State management |
| Socket.io Client | ^4.7 | Real-time WebSocket |
| Axios | ^1.7 | HTTP client |
| expo-notifications | ~0.29 | Local notification |
| expo-secure-store | ~14.0 | Simpan token aman |

### Firmware
| Teknologi | Fungsi |
|-----------|--------|
| ESP32 + Arduino | Mikrokontroler utama |
| PlatformIO | Build & upload firmware |
| PubSubClient | MQTT client |
| ArduinoJson | Serialize data sensor |

---

## 📁 Struktur Folder

```
ecosmart-feeder/
├── docker-compose.yml          ← PostgreSQL + InfluxDB + MQTT broker
├── mosquitto.conf              ← Konfigurasi MQTT
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── app.ts                    ← Entry point server
│   │   │   ├── plugins/
│   │   │   │   ├── db.ts                 ← PostgreSQL plugin
│   │   │   │   ├── influx.ts             ← InfluxDB plugin
│   │   │   │   └── socket.ts             ← Socket.io (WebSocket)
│   │   │   └── modules/
│   │   │       ├── auth/                 ← Register, login, JWT
│   │   │       ├── iot/                  ← Ingest sensor, MQTT bridge
│   │   │       ├── devices/              ← Manajemen device ESP32
│   │   │       └── alerts/               ← Alert engine + threshold
│   │   ├── drizzle/
│   │   │   └── schema.ts                 ← Schema database
│   │   ├── .env.example                  ← Template environment variable
│   │   └── drizzle.config.ts
│   └── mobile/
│       ├── app/
│       │   ├── (auth)/                   ← login.tsx, signup.tsx
│       │   └── (app)/                    ← dashboard, monitoring, control,
│       │                                    alerts, chat, settings, schedule
│       ├── components/                   ← SensorCard, AIChatFAB, dll
│       ├── hooks/
│       │   ├── useWebSocket.ts           ← Koneksi real-time
│       │   └── usePushNotification.ts    ← Local notification
│       ├── stores/
│       │   ├── authStore.ts              ← Session user
│       │   └── sensorStore.ts            ← Data sensor real-time
│       └── lib/
│           └── api.ts                    ← Axios instance + auto token
└── firmware/
    └── esp32/
        ├── main.cpp                      ← Kode utama ESP32
        ├── config.h                      ← ⚠️ Edit sebelum upload
        └── platformio.ini                ← Konfigurasi PlatformIO
```

---

## 🚀 Setup & Instalasi

### Prasyarat

- **Node.js** 20+
- **Docker Desktop** (running)
- **PlatformIO** — VS Code extension (untuk upload ke ESP32)
- **Expo Go** — install di iPhone/Android

---

### 1. Clone & masuk folder

```bash
git clone https://github.com/username/ecosmart-feeder.git
cd ecosmart-feeder
```

---

### 2. Jalankan database (Docker)

```bash
docker compose up -d
```

Pastikan 3 service berjalan:
```bash
docker compose ps
# ecosmart_postgres   ← running :5432
# ecosmart_influxdb   ← running :8086
# ecosmart_mqtt       ← running :1883
```

Buka InfluxDB UI: [http://localhost:8086](http://localhost:8086)
- Username: `admin` / Password: `adminpassword`
- Token sudah otomatis: `ecosmart-dev-token-12345`

---

### 3. Setup Backend

```bash
cd apps/backend
npm install
cp .env.example .env
```

Edit `.env` — minimal isi dua ini:
```env
JWT_SECRET=isi_dengan_string_random_panjang
INFLUXDB_TOKEN=ecosmart-dev-token-12345
```

> Generate JWT_SECRET:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

Jalankan migrasi database dan start server:
```bash
npm run db:generate
npm run db:migrate
npm run dev
```

Cek: [http://localhost:3000/health](http://localhost:3000/health) → `{"status":"ok"}`

---

### 4. Daftarkan Akun & Device (Postman)

**Register akun:**
```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "name": "Nama Kamu",
  "email": "email@kamu.com",
  "password": "Password123"
}
```

**Login & simpan token:**
```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "email@kamu.com",
  "password": "Password123"
}
```
→ Simpan `accessToken` dari response.

**Daftarkan device ESP32:**
```http
POST http://localhost:3000/api/devices
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Kolam Lele #1",
  "location": "Kandang Utama"
}
```
→ Simpan `id` (deviceId) dan `deviceToken` dari response.

---

### 5. Setup Firmware ESP32

Buka `firmware/esp32/config.h` dan isi:

```cpp
#define WIFI_SSID      "NAMA_WIFI_KAMU"
#define WIFI_PASSWORD  "PASSWORD_WIFI_KAMU"
#define MQTT_BROKER    "192.168.X.X"        // IP komputer (cek: ipconfig)
#define DEVICE_ID      "uuid-dari-step-4"
#define DEVICE_TOKEN   "token-dari-step-4"
```

Upload ke ESP32 via PlatformIO (klik tombol **→** di toolbar VS Code).

---

### 6. Setup Mobile

```bash
cd apps/mobile
npm install
```

Ganti IP di dua file berikut (sesuaikan dengan IP komputer kamu):

**`apps/mobile/lib/api.ts`** baris ~7:
```typescript
const BASE_URL = 'http://192.168.X.X:3000/api';
```

**`apps/mobile/hooks/useWebSocket.ts`** baris ~11:
```typescript
const SOCKET_URL = 'http://192.168.X.X:3000';
```

> **Cara cari IP komputer:**
> - Windows: jalankan `ipconfig` → lihat IPv4 Address
> - Emulator Android bawaan: gunakan `10.0.2.2` (tidak perlu ganti)

Jalankan app:
```bash
npx expo start --clear
```

Scan QR code dengan Expo Go di iPhone/Android.

---

## 🧪 Test Tanpa ESP32

Kirim data sensor manual via Postman untuk test dashboard real-time:

**Kirim data sensor normal:**
```http
POST http://localhost:3000/api/iot/ingest
Content-Type: application/json

{
  "deviceId": "uuid-device",
  "deviceToken": "token-device",
  "temperature": 28.5,
  "phLevel": 7.2,
  "feedLevel": 75,
  "lightLevel": 540
}
```

**Trigger alert & notifikasi** (nilai melewati threshold):
```http
POST http://localhost:3000/api/iot/test-alert
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "deviceId": "uuid-device",
  "temperature": 35,
  "feedLevel": 8
}
```

Dashboard mobile akan update otomatis dalam < 1 detik dan notifikasi akan muncul di HP.

---

## ⚠️ Threshold Alert

| Sensor | Batas Bawah | Batas Atas | Satuan |
|--------|-------------|------------|--------|
| Suhu | 24 | 32 | °C |
| pH Air | 6.5 | 8.5 | — |
| Level Pakan | 20 | — | % |

---

## 🔌 API Endpoints

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/auth/register` | — | Daftar akun baru |
| POST | `/api/auth/login` | — | Login, dapat token |
| POST | `/api/auth/refresh` | — | Refresh access token |
| GET | `/api/devices` | ✅ | List device milik user |
| POST | `/api/devices` | ✅ | Daftarkan device baru |
| DELETE | `/api/devices/:id` | ✅ | Hapus device |
| POST | `/api/iot/ingest` | Device Token | Kirim data sensor (ESP32) |
| GET | `/api/iot/sensors/latest` | ✅ | Data sensor terbaru |
| GET | `/api/iot/sensors/history` | ✅ | Data historis untuk grafik |
| POST | `/api/iot/test-alert` | ✅ | Test trigger alert & notifikasi |
| GET | `/api/alerts/rules` | ✅ | Lihat threshold rules |
| GET | `/health` | — | Health check server |

---

## 📡 WebSocket Events

| Event | Arah | Deskripsi |
|-------|------|-----------|
| `join:device` | Client → Server | Join room device tertentu |
| `sensor:update` | Server → Client | Data sensor baru masuk |
| `alert:triggered` | Server → Client | Threshold terlewati |
| `request:latest` | Client → Server | Minta data sensor terbaru |

---

## 🗄️ Database Schema

```
users
  id, name, email, password_hash, role, created_at

devices
  id, name, user_id, device_token, status, location, last_seen_at

refresh_tokens
  id, token, user_id, expires_at, is_revoked
```

Data sensor time-series disimpan di **InfluxDB** (measurement: `sensor_readings`).

---

## 🔧 Environment Variables

Lihat `.env.example` untuk daftar lengkap. Variabel wajib:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/ecosmart_db
JWT_SECRET=<random 64 karakter>
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=<token dari InfluxDB UI>
INFLUXDB_ORG=ecosmart
INFLUXDB_BUCKET=sensors
MQTT_BROKER_URL=mqtt://localhost:1883
```

---

## 📋 Catatan Penting

- **Notifikasi** hanya berjalan saat app terbuka (foreground) di Expo Go. Untuk notifikasi background, diperlukan development build (`npx expo run:ios`).
- **IP address** di `api.ts`, `useWebSocket.ts`, dan `config.h` harus diubah sesuai IP komputer yang menjalankan backend.
- **`deviceToken`** dari response `POST /api/devices` hanya tampil sekali — simpan baik-baik sebelum dimasukkan ke `config.h`.
- Aplikasi saat ini berjalan **lokal** (butuh laptop menyala). Untuk produksi, deploy backend ke Railway/Render dan database ke layanan cloud.

---

## 📄 Lisensi

MIT License — bebas digunakan dan dimodifikasi.
