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
│   ESP32     │ ────────────► │  Backend Fastify │ ───────────────► │  Mobile App │
│  (Sensor)   │               │  + PostgreSQL    │                  │  (Expo RN)  │
└─────────────┘               │  + InfluxDB      │                  └─────────────┘
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

## 📋 Catatan Penting

- **Notifikasi** hanya berjalan saat app terbuka (foreground) di Expo Go. Untuk notifikasi background, diperlukan development build (`npx expo run:ios`).
- **IP address** di `api.ts`, `useWebSocket.ts`, dan `config.h` harus diubah sesuai IP komputer yang menjalankan backend.
- **`deviceToken`** dari response `POST /api/devices` hanya tampil sekali — simpan baik-baik sebelum dimasukkan ke `config.h`.
- Aplikasi saat ini berjalan **lokal** (butuh laptop menyala). Untuk produksi, deploy backend ke Railway/Render dan database ke layanan cloud.

---

## 📄 Lisensi

MIT License — bebas digunakan dan dimodifikasi.