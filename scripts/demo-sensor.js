/**
 * EcoSmart Feeder — Demo Sensor Simulator
 * ========================================
 * Simulasi data sensor ESP32 tanpa hardware fisik.
 * Kirim data real-time ke backend setiap 5 detik.
 *
 * Usage:
 *   node scripts/demo-sensor.js
 */

// ── KONFIGURASI — GANTI SESUAI DATA KAMU ─────────────────────────────────────
const CONFIG = {
  BASE_URL:     'https://rpl-kelompok-12.onrender.com/api',
  EMAIL:        'user@example.com',
  PASSWORD:     'Password123456',
  DEVICE_ID:    '6079e5ef-566b-4ab1-b976-2d7c67f28c97',
  DEVICE_TOKEN: '377dd62b1563420e45eea956e53683b5d50accada5d48a050e35c0515ce0dd0f',
  INTERVAL:     1000,
};
// ─────────────────────────────────────────────────────────────────────────────

let token     = null;
let iteration = 0;

function generateSensorData() {
  iteration++;

  const temperature = +(26 + 3 * Math.sin(iteration * 0.3) + (Math.random() - 0.5)).toFixed(1);
  const phLevel     = +(7.1 + 0.4 * Math.sin(iteration * 0.15) + (Math.random() - 0.5) * 0.2).toFixed(2);
  const feedLevel   = +(Math.max(45, 95 - (iteration % 100) + (Math.random() - 0.5) * 2)).toFixed(1);
  const hour        = (Math.floor(iteration / 12)) % 24;
  const isDay       = hour >= 6 && hour <= 18;
  const lightLevel  = Math.round(isDay
    ? 300 + 200 * Math.sin((hour - 6) * Math.PI / 12) + Math.random() * 50
    : 20 + Math.random() * 30
  );
  return { temperature, phLevel, feedLevel, lightLevel };
}

async function login() {
  console.log(`🔐 Login sebagai ${CONFIG.EMAIL}...`);
  const res  = await fetch(`${CONFIG.BASE_URL}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: CONFIG.EMAIL, password: CONFIG.PASSWORD }),
  });
  const data = await res.json();
  if (!data.data?.accessToken) throw new Error(`Login gagal: ${JSON.stringify(data)}`);
  token = data.data.accessToken;
  console.log('✅ Login berhasil');
}

async function sendSensorData() {
  const sensor = generateSensorData();

  try {
    let res, data;

    if (CONFIG.DEVICE_TOKEN) {
      // Pakai /iot/ingest — lebih lengkap, simpan ke InfluxDB
      res = await fetch(`${CONFIG.BASE_URL}/iot/ingest`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          deviceId:    CONFIG.DEVICE_ID,
          deviceToken: CONFIG.DEVICE_TOKEN,
          ...sensor,
        }),
        signal: AbortSignal.timeout(8000), // timeout 8 detik
      });
    } else {
      // Fallback ke /iot/test-alert — butuh token login
      res = await fetch(`${CONFIG.BASE_URL}/iot/test-alert`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body:   JSON.stringify({ deviceId: CONFIG.DEVICE_ID, ...sensor }),
        signal: AbortSignal.timeout(8000), // timeout 8 detik
      });
    }

    data = await res.json();

    if (!res.ok) {
      console.error(`❌ Error ${res.status}:`, JSON.stringify(data));
      if (res.status === 401) await login();
      return;
    }

    const alertCount = data.data?.triggered?.length ?? data.data?.alerts ?? 0;
    const alertInfo  = alertCount > 0 ? ` ⚠️  ${alertCount} alert!` : '';
    console.log(
      `📊 [${new Date().toLocaleTimeString('id-ID')}]`,
      `Suhu: ${sensor.temperature}°C`,
      `| pH: ${sensor.phLevel}`,
      `| Pakan: ${sensor.feedLevel}%`,
      `| Cahaya: ${sensor.lightLevel}lx`,
      alertInfo
    );
  } catch (err) {
    console.error('❌ Network error:', err.message);
  }
}

async function main() {
  console.log('\n🐟 EcoSmart Feeder — Demo Sensor Simulator');
  console.log('==========================================');
  console.log(`📡 Backend  : ${CONFIG.BASE_URL}`);
  console.log(`📦 Device ID: ${CONFIG.DEVICE_ID}`);
  console.log(`🔑 Mode     : ${CONFIG.DEVICE_TOKEN ? 'ingest (deviceToken)' : 'test-alert (JWT)'}`);
  console.log(`⏱️  Interval : ${CONFIG.INTERVAL / 1000} detik`);
  console.log('Tekan Ctrl+C untuk berhenti\n');

  if (!CONFIG.DEVICE_TOKEN) await login();

  // Pakai rekursif setTimeout — request berikutnya baru dikirim
  // setelah yang sebelumnya selesai, tidak akan numpuk/stuck
  const loop = async () => {
    await sendSensorData();
    setTimeout(loop, CONFIG.INTERVAL);
  };

  loop();
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
