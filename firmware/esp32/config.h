#ifndef CONFIG_H
#define CONFIG_H

// ── WiFi ──────────────────────────────────────────────────────────────────────
#define WIFI_SSID       "NAMA_WIFI_KAMU"
#define WIFI_PASSWORD   "PASSWORD_WIFI_KAMU"

// ── MQTT Broker ───────────────────────────────────────────────────────────────
// Ganti dengan IP komputer yang menjalankan docker compose
// Cari IP komputer: ipconfig (Windows) / ifconfig (Mac/Linux)
#define MQTT_BROKER     "192.168.1.42"   // <-- GANTI INI
#define MQTT_PORT       1883
#define MQTT_CLIENT_ID  "esp32-ecosmart-01"

// ── Device Identity ───────────────────────────────────────────────────────────
// Dapatkan ini setelah daftarkan device via API POST /api/devices
#define DEVICE_ID       "UUID-DEVICE-DARI-DATABASE"   // <-- GANTI INI
#define DEVICE_TOKEN    "TOKEN-DEVICE-DARI-DATABASE"  // <-- GANTI INI

// ── MQTT Topics ───────────────────────────────────────────────────────────────
#define TOPIC_SENSORS   "ecosmart/" DEVICE_ID "/sensors"
#define TOPIC_STATUS    "ecosmart/" DEVICE_ID "/status"
#define TOPIC_COMMANDS  "ecosmart/" DEVICE_ID "/commands"

// ── Pin Sensor ────────────────────────────────────────────────────────────────
#define PIN_TEMP_SENSOR     4    // DS18B20 atau DHT22
#define PIN_PH_SENSOR       34   // Analog input (ADC1)
#define PIN_LDR_SENSOR      35   // Analog input (ADC1)
#define PIN_ULTRASONIC_TRIG 5    // Sensor ultrasonik TRIG
#define PIN_ULTRASONIC_ECHO 18   // Sensor ultrasonik ECHO
#define PIN_RELAY           2    // Relay motor pakan

// ── Kalibrasi Sensor ─────────────────────────────────────────────────────────
#define PH_VOLTAGE_REF      3.3   // Tegangan referensi ESP32 (volt)
#define PH_OFFSET           0.0   // Offset kalibrasi pH (sesuaikan)
#define FEED_CONTAINER_CM   30.0  // Tinggi wadah pakan dalam cm (saat penuh)
#define FEED_EMPTY_CM       2.0   // Jarak minimum sensor ke pakan (dianggap habis)

// ── Interval ──────────────────────────────────────────────────────────────────
#define SENSOR_INTERVAL_MS  5000  // Baca & kirim sensor setiap 5 detik
#define RECONNECT_DELAY_MS  3000  // Coba reconnect setiap 3 detik

#endif
