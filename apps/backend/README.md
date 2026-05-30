# EcoSmart Feeder — Backend API

## Tech Stack
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL (Supabase) + InfluxDB Cloud
- **Real-time**: Socket.io
- **MQTT**: HiveMQ Cloud
- **AI**: Groq API (Llama 3)

## Deploy ke Render

### 1. Push ke GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/ecosmart-backend.git
git push -u origin main
```

### 2. Buat Web Service di Render
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

### 3. Environment Variables di Render
```
NODE_ENV            = production
DATABASE_URL        = postgresql://... (Supabase)
JWT_SECRET          = random-64-chars
INFLUXDB_URL        = https://ap-southeast-1-1.aws.cloud2.influxdata.com
INFLUXDB_TOKEN      = token-influxdb-cloud
INFLUXDB_ORG        = org-influxdb
INFLUXDB_BUCKET     = sensors
MQTT_BROKER_URL     = mqtts://cluster.hivemq.cloud:8883
MQTT_USERNAME       = ecosmart-backend
MQTT_PASSWORD       = password-hivemq
GROQ_API_KEY        = gsk_xxxxx
GROQ_MODEL          = llama3-8b-8192
```

### 4. Jalankan migrasi ke Supabase
```bash
# Set DATABASE_URL ke Supabase dulu di .env lokal
npm run db:migrate
```

## Endpoints
- `POST /api/auth/register` — Daftar akun
- `POST /api/auth/login`    — Login
- `POST /api/devices`       — Daftarkan ESP32
- `POST /api/iot/ingest`    — Kirim data sensor
- `POST /api/chat/message`  — Chat AI
- `GET  /health`            — Health check
