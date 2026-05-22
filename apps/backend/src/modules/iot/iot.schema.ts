import { z } from 'zod';

// ── Data yang dikirim ESP32 ke backend ────────────────────────────────────────
// ESP32 publish ke MQTT atau POST ke /api/iot/ingest

export const sensorDataSchema = z.object({
  // ID device (sama dengan yang ada di tabel devices di PostgreSQL)
  deviceId: z.string().uuid('Device ID harus berupa UUID'),

  // Token autentikasi device — digenerate saat device didaftarkan
  deviceToken: z.string().min(1, 'Device token wajib diisi'),

  // Data sensor — semua opsional karena mungkin ada sensor yang tidak terpasang
  temperature: z
    .number()
    .min(-10, 'Suhu terlalu rendah')
    .max(60, 'Suhu terlalu tinggi')
    .optional(),

  phLevel: z
    .number()
    .min(0, 'pH tidak boleh kurang dari 0')
    .max(14, 'pH tidak boleh lebih dari 14')
    .optional(),

  feedLevel: z
    .number()
    .min(0, 'Level pakan tidak boleh negatif')
    .max(100, 'Level pakan maksimal 100%')
    .optional(),

  lightLevel: z
    .number()
    .min(0)
    .max(4095) // 12-bit ADC ESP32
    .optional(),

  // Timestamp dari ESP32 (opsional — kalau tidak ada, pakai waktu server)
  timestamp: z.string().datetime().optional(),
});

export type SensorDataInput = z.infer<typeof sensorDataSchema>;

// ── Payload dari MQTT ─────────────────────────────────────────────────────────
// Format JSON yang dikirim ESP32 ke MQTT topic:
// Topic: ecosmart/{deviceId}/sensors
// Payload: { deviceToken, temperature, phLevel, feedLevel, lightLevel }

export const mqttPayloadSchema = z.object({
  deviceToken: z.string().min(1),
  temperature: z.number().optional(),
  phLevel:     z.number().optional(),
  feedLevel:   z.number().optional(),
  lightLevel:  z.number().optional(),
  timestamp:   z.string().datetime().optional(),
});

export type MqttPayload = z.infer<typeof mqttPayloadSchema>;

// ── Response types ────────────────────────────────────────────────────────────

export interface SensorReading {
  deviceId:    string;
  temperature?: number;
  phLevel?:     number;
  feedLevel?:   number;
  lightLevel?:  number;
  timestamp:   string;
}

export interface SensorStats {
  field:   string;
  avg:     number;
  min:     number;
  max:     number;
  last:    number;
  unit:    string;
}

// ── Threshold untuk alert ─────────────────────────────────────────────────────

export const SENSOR_THRESHOLDS = {
  temperature: { min: 24, max: 32, unit: '°C' },
  phLevel:     { min: 6.5, max: 8.5, unit: 'pH' },
  feedLevel:   { min: 20, max: 100, unit: '%' },
} as const;
