import { z } from 'zod';
export const sensorDataSchema = z.object({
  deviceId:    z.string().uuid(),
  deviceToken: z.string().min(1),
  temperature: z.number().min(-10).max(60).optional(),
  phLevel:     z.number().min(0).max(14).optional(),
  feedLevel:   z.number().min(0).max(100).optional(),
  lightLevel:  z.number().min(0).max(4095).optional(),
  timestamp:   z.string().datetime().optional(),
});
export const mqttPayloadSchema = z.object({
  deviceToken: z.string().min(1),
  temperature: z.number().optional(),
  phLevel:     z.number().optional(),
  feedLevel:   z.number().optional(),
  lightLevel:  z.number().optional(),
  timestamp:   z.string().datetime().optional(),
});
export type SensorDataInput = z.infer<typeof sensorDataSchema>;
export type MqttPayload     = z.infer<typeof mqttPayloadSchema>;
export interface SensorReading { deviceId: string; temperature?: number; phLevel?: number; feedLevel?: number; lightLevel?: number; timestamp: string; }
export interface SensorStats   { field: string; avg: number; min: number; max: number; last: number; unit: string; }
export const SENSOR_THRESHOLDS = {
  temperature: { min: 24, max: 32, unit: '°C' },
  phLevel:     { min: 6.5, max: 8.5, unit: 'pH' },
  feedLevel:   { min: 20, max: 100, unit: '%' },
} as const;
