#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

#define MQTT_BROKER   "mqtts://ecosmart-backend:EcoSmart2026@6f4b915a71cd4faea720da6f80917ca8.s1.eu.hivemq.cloud:8883"
#define MQTT_PORT     8883
#define MQTT_USE_SSL  true
#define MQTT_USER     "ecosmart-backend"
#define MQTT_PASSWORD "EcoSmart2026"
// ── Client WiFi (pakai Secure kalau SSL) ─────────────────────────────────────
#if MQTT_USE_SSL
  WiFiClientSecure wifiClient;
#else
  WiFiClient wifiClient;
#endif

PubSubClient  mqttClient(wifiClient);
unsigned long lastSensorRead = 0;

// ── Baca Sensor ───────────────────────────────────────────────────────────────

float readTemperature() {
  // TODO: ganti dengan sensor asli (DHT22 / DS18B20)
  // Untuk testing tanpa sensor, pakai simulasi ini:
  return 26.0 + (random(0, 400) / 100.0);
}

float readPhLevel() {
  int   raw     = analogRead(PIN_PH_SENSOR);
  float voltage = raw * (PH_VOLTAGE_REF / 4095.0);
  float ph      = 7.0 + ((2.5 - voltage) * 3.5) + PH_OFFSET;
  return constrain(ph, 0.0, 14.0);
  // Untuk testing: return 7.0 + (random(-20, 20) / 100.0);
}

float readFeedLevel() {
  // Ultrasonik
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(PIN_ULTRASONIC_TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  long  duration = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 30000);
  float distance = (duration * 0.034) / 2.0;
  float level    = ((FEED_CONTAINER_CM - distance) / (FEED_CONTAINER_CM - FEED_EMPTY_CM)) * 100.0;
  return constrain(level, 0.0, 100.0);
  // Untuk testing: return 70.0 + (random(-500, 500) / 100.0);
}

int readLightLevel() {
  return analogRead(PIN_LDR_SENSOR);
}

// ── WiFi ──────────────────────────────────────────────────────────────────────

void connectWifi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print("."); attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n✅ WiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n❌ WiFi failed! Restarting...");
    ESP.restart();
  }
}

// ── MQTT Callback (terima perintah dari backend) ──────────────────────────────

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];

  Serial.printf("📩 Command [%s]: %s\n", topic, message.c_str());

  JsonDocument doc;
  if (deserializeJson(doc, message)) return;

  if (String(topic) == TOPIC_COMMANDS) {
    const char* command = doc["command"];
    if (!command) return;

    if (strcmp(command, "feed_now") == 0) {
      int duration = doc["duration"] | 3000;
      Serial.printf("🍽 Feeding for %dms...\n", duration);
      digitalWrite(PIN_RELAY, HIGH);
      delay(duration);
      digitalWrite(PIN_RELAY, LOW);
      Serial.println("✅ Feeding done!");
    }
  }
}

// ── MQTT Connect ──────────────────────────────────────────────────────────────

void connectMqtt() {
  while (!mqttClient.connected()) {
    Serial.printf("Connecting to MQTT [%s:%d]...", MQTT_BROKER, MQTT_PORT);

    bool connected = false;

    #if MQTT_USE_SSL
      // HiveMQ Cloud — dengan username & password
      connected = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD);
    #else
      // Local Mosquitto — tanpa auth
      connected = mqttClient.connect(MQTT_CLIENT_ID);
    #endif

    if (connected) {
      Serial.println(" ✅ connected!");
      mqttClient.subscribe(TOPIC_COMMANDS);
      Serial.printf("Subscribed to: %s\n", TOPIC_COMMANDS);

      // Kirim status online ke backend
      JsonDocument statusDoc;
      statusDoc["status"]    = "online";
      statusDoc["deviceId"]  = DEVICE_ID;
      statusDoc["ipAddress"] = WiFi.localIP().toString();
      char statusPayload[200];
      serializeJson(statusDoc, statusPayload);
      mqttClient.publish(TOPIC_STATUS, statusPayload);

    } else {
      Serial.printf(" ❌ failed rc=%d, retry in 3s\n", mqttClient.state());
      delay(RECONNECT_DELAY_MS);
    }
  }
}

// ── Publish Sensor Data ───────────────────────────────────────────────────────

void publishSensorData() {
  float temperature = readTemperature();
  float phLevel     = readPhLevel();
  float feedLevel   = readFeedLevel();
  int   lightLevel  = readLightLevel();

  JsonDocument doc;
  doc["deviceToken"] = DEVICE_TOKEN;
  doc["temperature"] = round(temperature * 100.0) / 100.0;
  doc["phLevel"]     = round(phLevel     * 100.0) / 100.0;
  doc["feedLevel"]   = round(feedLevel   * 10.0)  / 10.0;
  doc["lightLevel"]  = lightLevel;

  char payload[512];
  serializeJson(doc, payload);

  if (mqttClient.publish(TOPIC_SENSORS, payload)) {
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Serial.printf("📤 Published → %s\n", TOPIC_SENSORS);
    Serial.printf("🌡️  Suhu   : %.2f°C\n", temperature);
    Serial.printf("💧 pH     : %.2f\n",    phLevel);
    Serial.printf("🌾 Pakan  : %.1f%%\n",  feedLevel);
    Serial.printf("☀️  Cahaya : %d\n",     lightLevel);
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } else {
    Serial.println("❌ Publish failed — cek koneksi MQTT");
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n╔══════════════════════════════╗");
  Serial.println("║   EcoSmart Feeder ESP32      ║");
  Serial.println("╚══════════════════════════════╝");

  // Inisialisasi pin
  pinMode(PIN_ULTRASONIC_TRIG, OUTPUT);
  pinMode(PIN_ULTRASONIC_ECHO, INPUT);
  pinMode(PIN_RELAY,           OUTPUT);
  digitalWrite(PIN_RELAY, LOW); // Pastikan relay OFF saat start

  // Koneksi WiFi
  connectWifi();

  // Setup MQTT
  #if MQTT_USE_SSL
    // HiveMQ Cloud: skip certificate verification
    wifiClient.setInsecure();
    Serial.println("MQTT: SSL enabled (HiveMQ Cloud mode)");
  #endif

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);

  Serial.printf("Device ID    : %s\n", DEVICE_ID);
  Serial.printf("MQTT Broker  : %s:%d\n", MQTT_BROKER, MQTT_PORT);
  Serial.printf("Sensor topic : %s\n", TOPIC_SENSORS);
  Serial.println("\nSetup complete! Starting sensor loop...\n");
}

// ── Loop ──────────────────────────────────────────────────────────────────────

void loop() {
  // Reconnect WiFi kalau putus
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectWifi();
  }

  // Reconnect MQTT kalau putus
  if (!mqttClient.connected()) {
    connectMqtt();
  }

  // Process incoming MQTT messages
  mqttClient.loop();

  // Baca & kirim sensor setiap SENSOR_INTERVAL_MS
  unsigned long now = millis();
  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {
    lastSensorRead = now;
    publishSensorData();
  }
}
