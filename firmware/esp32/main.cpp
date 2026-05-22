#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

// ── Objek global ──────────────────────────────────────────────────────────────
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastSensorRead = 0;

// ── Fungsi: Baca Suhu ─────────────────────────────────────────────────────────
// Untuk testing pakai nilai simulasi dulu
// Nanti ganti dengan library DHT22 atau DS18B20 yang sebenarnya
float readTemperature() {
  // TODO: ganti dengan kode sensor asli
  // Contoh DHT22:
  //   return dht.readTemperature();
  // Contoh DS18B20:
  //   sensors.requestTemperatures();
  //   return sensors.getTempCByIndex(0);

  // Simulasi: nilai random antara 26-30°C
  return 26.0 + (random(0, 400) / 100.0);
}

// ── Fungsi: Baca pH ───────────────────────────────────────────────────────────
float readPhLevel() {
  // Baca ADC dari sensor pH
  int   rawAdc    = analogRead(PIN_PH_SENSOR);
  float voltage   = rawAdc * (PH_VOLTAGE_REF / 4095.0);
  // Rumus konversi voltage ke pH (sesuaikan dengan kalibrasi sensor kamu)
  float phValue   = 7.0 + ((2.5 - voltage) * 3.5) + PH_OFFSET;

  // Batasi range 0-14
  phValue = constrain(phValue, 0.0, 14.0);
  return phValue;

  // Untuk testing tanpa sensor, uncomment baris ini:
  // return 6.8 + (random(-20, 20) / 100.0);
}

// ── Fungsi: Baca Level Pakan (Ultrasonik) ─────────────────────────────────────
float readFeedLevel() {
  // Kirim pulsa trigger
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

  // Baca durasi echo
  long duration  = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 30000);
  float distance = (duration * 0.034) / 2.0;  // cm

  // Konversi jarak ke persentase level pakan
  // Makin dekat jarak sensor ke pakan = makin penuh
  float level = ((FEED_CONTAINER_CM - distance) / (FEED_CONTAINER_CM - FEED_EMPTY_CM)) * 100.0;
  level = constrain(level, 0.0, 100.0);

  // Untuk testing tanpa sensor, uncomment baris ini:
  // return 70.0 + (random(-500, 500) / 100.0);

  return level;
}

// ── Fungsi: Baca Cahaya (LDR) ─────────────────────────────────────────────────
int readLightLevel() {
  return analogRead(PIN_LDR_SENSOR); // 0-4095 (12-bit ADC ESP32)
}

// ── Fungsi: Koneksi WiFi ──────────────────────────────────────────────────────
void connectWifi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ WiFi connection failed! Restarting...");
    ESP.restart();
  }
}

// ── Fungsi: Handle perintah dari backend ──────────────────────────────────────
void handleCommand(const char* command, JsonDocument& doc) {
  Serial.print("Command received: ");
  Serial.println(command);

  if (strcmp(command, "feed_now") == 0) {
    // Aktifkan relay untuk beri pakan
    int duration = doc["duration"] | 3000; // default 3 detik
    Serial.print("Feeding for ");
    Serial.print(duration);
    Serial.println("ms");

    digitalWrite(PIN_RELAY, HIGH);
    delay(duration);
    digitalWrite(PIN_RELAY, LOW);

    Serial.println("Feeding done");
  }
}

// ── Fungsi: Callback MQTT (terima pesan dari backend) ────────────────────────
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("MQTT message received [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);

  // Parse JSON
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }

  // Handle perintah dari backend
  if (String(topic) == TOPIC_COMMANDS) {
    const char* command = doc["command"];
    if (command) handleCommand(command, doc);
  }
}

// ── Fungsi: Koneksi MQTT ──────────────────────────────────────────────────────
void connectMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT broker...");

    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println(" ✅ connected!");

      // Subscribe ke topik commands dari backend
      mqttClient.subscribe(TOPIC_COMMANDS);
      Serial.print("Subscribed to: ");
      Serial.println(TOPIC_COMMANDS);

      // Kirim status online ke backend
      JsonDocument statusDoc;
      statusDoc["status"]    = "online";
      statusDoc["deviceId"]  = DEVICE_ID;
      statusDoc["ipAddress"] = WiFi.localIP().toString();

      char statusPayload[200];
      serializeJson(statusDoc, statusPayload);
      mqttClient.publish(TOPIC_STATUS, statusPayload);

    } else {
      Serial.print(" ❌ failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" — retrying in 3s");
      delay(RECONNECT_DELAY_MS);
    }
  }
}

// ── Fungsi: Kirim data sensor ke MQTT ────────────────────────────────────────
void publishSensorData() {
  float temperature = readTemperature();
  float phLevel     = readPhLevel();
  float feedLevel   = readFeedLevel();
  int   lightLevel  = readLightLevel();

  // Build JSON payload
  JsonDocument doc;
  doc["deviceToken"] = DEVICE_TOKEN;
  doc["temperature"] = round(temperature * 100.0) / 100.0;  // 2 desimal
  doc["phLevel"]     = round(phLevel     * 100.0) / 100.0;
  doc["feedLevel"]   = round(feedLevel   * 10.0)  / 10.0;   // 1 desimal
  doc["lightLevel"]  = lightLevel;

  char payload[512];
  serializeJson(doc, payload);

  // Publish ke MQTT
  bool published = mqttClient.publish(TOPIC_SENSORS, payload, false);

  if (published) {
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Serial.print("📤 Sent to: "); Serial.println(TOPIC_SENSORS);
    Serial.print("🌡  Temp   : "); Serial.print(temperature); Serial.println("°C");
    Serial.print("💧 pH     : "); Serial.println(phLevel);
    Serial.print("🍽  Feed   : "); Serial.print(feedLevel); Serial.println("%");
    Serial.print("☀️  Light  : "); Serial.println(lightLevel);
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } else {
    Serial.println("❌ Failed to publish sensor data");
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== EcoSmart Feeder ESP32 ===");

  // Inisialisasi pin
  pinMode(PIN_ULTRASONIC_TRIG, OUTPUT);
  pinMode(PIN_ULTRASONIC_ECHO, INPUT);
  pinMode(PIN_RELAY,           OUTPUT);
  digitalWrite(PIN_RELAY, LOW); // Pastikan relay OFF saat start

  // Koneksi WiFi
  connectWifi();

  // Setup MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);

  Serial.println("Setup complete. Starting sensor loop...\n");
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

  // Process MQTT messages yang masuk
  mqttClient.loop();

  // Baca dan kirim data sensor setiap SENSOR_INTERVAL_MS
  unsigned long now = millis();
  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {
    lastSensorRead = now;
    publishSensorData();
  }
}
