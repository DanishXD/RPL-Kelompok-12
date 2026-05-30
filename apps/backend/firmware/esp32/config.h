#ifndef CONFIG_H
#define CONFIG_H

// ── WiFi ──────────────────────────────────────────────────────────────────────
#define WIFI_SSID       "NAMA_WIFI_KAMU"
#define WIFI_PASSWORD   "PASSWORD_WIFI_KAMU"

// ── MQTT Broker ───────────────────────────────────────────────────────────────
// Pilih salah satu:
//
// [A] LOCAL (development di rumah):
//     #define MQTT_BROKER   "192.168.1.100"   ← IP komputer
//     #define MQTT_PORT     1883
//     #define MQTT_USE_SSL  false
//
// [B] HIVEMQ CLOUD (production):
//     #define MQTT_BROKER   "abc123.s1.eu.hivemq.cloud"
//     #define MQTT_PORT     8883
//     #define MQTT_USE_SSL  true

#define MQTT_BROKER   "abc123.s1.eu.hivemq.cloud"  // <-- GANTI dengan cluster URL kamu
#define MQTT_PORT     8883
#define MQTT_USE_SSL  true

// HiveMQ Cloud credentials
#define MQTT_USER     "ecosmart-backend"   // <-- GANTI sesuai yang dibuat di HiveMQ
#define MQTT_PASSWORD "password-hivemq"    // <-- GANTI

#define MQTT_CLIENT_ID "esp32-ecosmart-01"

// ── Device (dapat dari halaman Setup Device di app) ───────────────────────────
#define DEVICE_ID     "UUID-DARI-APP"    // <-- GANTI
#define DEVICE_TOKEN  "TOKEN-DARI-APP"   // <-- GANTI

// ── MQTT Topics ───────────────────────────────────────────────────────────────
#define TOPIC_SENSORS  "ecosmart/" DEVICE_ID "/sensors"
#define TOPIC_STATUS   "ecosmart/" DEVICE_ID "/status"
#define TOPIC_COMMANDS "ecosmart/" DEVICE_ID "/commands"

// ── Pin Sensor ────────────────────────────────────────────────────────────────
#define PIN_PH_SENSOR       34   // Analog ADC1
#define PIN_LDR_SENSOR      35   // Analog ADC1
#define PIN_ULTRASONIC_TRIG 5
#define PIN_ULTRASONIC_ECHO 18
#define PIN_RELAY           2

// ── Kalibrasi ────────────────────────────────────────────────────────────────
#define PH_VOLTAGE_REF    3.3
#define PH_OFFSET         0.0
#define FEED_CONTAINER_CM 30.0
#define FEED_EMPTY_CM     2.0

// ── Interval ──────────────────────────────────────────────────────────────────
#define SENSOR_INTERVAL_MS 5000
#define RECONNECT_DELAY_MS 3000

#endif
