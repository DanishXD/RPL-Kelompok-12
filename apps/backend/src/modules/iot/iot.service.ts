import { Point } from '@influxdata/influxdb-client';
import { eq } from 'drizzle-orm';
import { FastifyInstance } from 'fastify';
import { devices } from '../../../drizzle/schema';
import type { SensorDataInput, SensorReading, SensorStats } from './iot.schema';
import { SENSOR_THRESHOLDS } from './iot.schema';

export class IotService {
  constructor(private fastify: FastifyInstance) {}

  // ── Verifikasi device token ───────────────────────────────────────────────
  // Setiap ESP32 punya token unik — cek ke PostgreSQL sebelum simpan data

  async verifyDevice(deviceId: string, deviceToken: string) {
    const db = this.fastify.db;

    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);

    if (!device) {
      throw { statusCode: 404, message: 'Device tidak ditemukan' };
    }

    if (device.deviceToken !== deviceToken) {
      throw { statusCode: 401, message: 'Device token tidak valid' };
    }

    if (device.status === 'inactive') {
      throw { statusCode: 403, message: 'Device tidak aktif' };
    }

    // Update lastSeenAt setiap kali device kirim data
    await db
      .update(devices)
      .set({ lastSeenAt: new Date() })
      .where(eq(devices.id, deviceId));

    return device;
  }

  // ── Simpan data sensor ke InfluxDB ────────────────────────────────────────
  // Setiap field sensor jadi satu Point terpisah untuk kemudahan query

  async saveSensorData(data: SensorDataInput): Promise<void> {
    const { writePoint, flush } = this.fastify.influx;
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

    // Buat satu Point dengan semua field sensor
    const point = new Point('sensor_readings')
      .tag('device_id', data.deviceId)
      .timestamp(timestamp);

    if (data.temperature !== undefined) {
      point.floatField('temperature', data.temperature);
    }
    if (data.phLevel !== undefined) {
      point.floatField('ph_level', data.phLevel);
    }
    if (data.feedLevel !== undefined) {
      point.floatField('feed_level', data.feedLevel);
    }
    if (data.lightLevel !== undefined) {
      point.intField('light_level', Math.round(data.lightLevel));
    }

    writePoint(point);

    // Flush langsung supaya data tersimpan segera
    // Untuk high-frequency data, bisa hapus flush dan biarkan batch otomatis
    await flush();

    this.fastify.log.debug(
      { deviceId: data.deviceId },
      'Sensor data saved to InfluxDB'
    );
  }

  // ── Ambil data sensor terbaru ─────────────────────────────────────────────
  // Dipakai di dashboard mobile untuk tampil nilai sensor saat ini

  async getLatestSensorData(deviceId: string): Promise<SensorReading> {
    const { queryApi } = this.fastify.influx;
    const bucket = process.env.INFLUXDB_BUCKET ?? 'sensors';

    // Flux query: ambil nilai terakhir setiap field dari 1 jam terakhir
    const query = `
      from(bucket: "${bucket}")
        |> range(start: -1h)
        |> filter(fn: (r) => r["_measurement"] == "sensor_readings")
        |> filter(fn: (r) => r["device_id"] == "${deviceId}")
        |> last()
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;

    const rows = await queryApi.collectRows<any>(query);

    if (rows.length === 0) {
      // Coba range lebih lama kalau 1 jam terakhir kosong
      const query24h = `
        from(bucket: "${bucket}")
          |> range(start: -24h)
          |> filter(fn: (r) => r["_measurement"] == "sensor_readings")
          |> filter(fn: (r) => r["device_id"] == "${deviceId}")
          |> last()
          |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      `;
      const rows24h = await queryApi.collectRows<any>(query24h);

      if (rows24h.length === 0) {
        throw { statusCode: 404, message: 'Belum ada data sensor untuk device ini' };
      }

      return this.formatSensorRow(deviceId, rows24h[0]);
    }

    return this.formatSensorRow(deviceId, rows[0]);
  }

  // ── Ambil data historis sensor ────────────────────────────────────────────
  // Dipakai di halaman monitoring untuk grafik trend

  async getSensorHistory(
    deviceId: string,
    range: '1h' | '24h' | '7d' | '30d' = '24h',
    field?: string
  ): Promise<Array<{ time: string; [key: string]: any }>> {
    const { queryApi } = this.fastify.influx;
    const bucket = process.env.INFLUXDB_BUCKET ?? 'sensors';

    // Tentukan window agregasi berdasarkan range
    const windowMap = {
      '1h':  '1m',   // Per menit untuk 1 jam
      '24h': '30m',  // Per 30 menit untuk 24 jam
      '7d':  '3h',   // Per 3 jam untuk 7 hari
      '30d': '1d',   // Per hari untuk 30 hari
    };
    const window = windowMap[range];

    const fieldFilter = field
      ? `|> filter(fn: (r) => r["_field"] == "${field}")`
      : '';

    const query = `
      from(bucket: "${bucket}")
        |> range(start: -${range})
        |> filter(fn: (r) => r["_measurement"] == "sensor_readings")
        |> filter(fn: (r) => r["device_id"] == "${deviceId}")
        ${fieldFilter}
        |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"])
    `;

    const rows = await queryApi.collectRows<any>(query);

    return rows.map((row) => ({
      time:        row._time,
      temperature: row.temperature  !== undefined ? Number(row.temperature.toFixed(2))  : undefined,
      phLevel:     row.ph_level     !== undefined ? Number(row.ph_level.toFixed(2))     : undefined,
      feedLevel:   row.feed_level   !== undefined ? Number(row.feed_level.toFixed(1))   : undefined,
      lightLevel:  row.light_level  !== undefined ? Math.round(row.light_level)         : undefined,
    }));
  }

  // ── Ambil statistik sensor (avg, min, max) ────────────────────────────────

  async getSensorStats(
    deviceId: string,
    range: '24h' | '7d' | '30d' = '24h'
  ): Promise<SensorStats[]> {
    const { queryApi } = this.fastify.influx;
    const bucket = process.env.INFLUXDB_BUCKET ?? 'sensors';

    const query = `
      from(bucket: "${bucket}")
        |> range(start: -${range})
        |> filter(fn: (r) => r["_measurement"] == "sensor_readings")
        |> filter(fn: (r) => r["device_id"] == "${deviceId}")
        |> group(columns: ["_field"])
    `;

    const results: SensorStats[] = [];

    // Query avg, min, max, last secara terpisah lalu gabungkan
    for (const stat of ['mean', 'min', 'max', 'last'] as const) {
      const statQuery = `
        ${query}
          |> ${stat}()
      `;
      const rows = await queryApi.collectRows<any>(statQuery);
      rows.forEach((row) => {
        const existing = results.find((r) => r.field === row._field);
        if (existing) {
          (existing as any)[stat === 'mean' ? 'avg' : stat] = Number(row._value.toFixed(2));
        } else {
          results.push({
            field: row._field,
            avg:   stat === 'mean' ? Number(row._value.toFixed(2)) : 0,
            min:   stat === 'min'  ? Number(row._value.toFixed(2)) : 0,
            max:   stat === 'max'  ? Number(row._value.toFixed(2)) : 0,
            last:  stat === 'last' ? Number(row._value.toFixed(2)) : 0,
            unit:  this.getUnit(row._field),
          });
        }
      });
    }

    return results;
  }

  // ── Cek apakah nilai sensor melewati threshold bahaya ─────────────────────

  checkThresholds(data: SensorDataInput): Array<{
    field: string;
    value: number;
    threshold: { min: number; max: number };
    status: 'low' | 'high';
  }> {
    const alerts = [];

    if (data.temperature !== undefined) {
      const t = SENSOR_THRESHOLDS.temperature;
      if (data.temperature < t.min)
        alerts.push({ field: 'temperature', value: data.temperature, threshold: t, status: 'low' as const });
      if (data.temperature > t.max)
        alerts.push({ field: 'temperature', value: data.temperature, threshold: t, status: 'high' as const });
    }

    if (data.phLevel !== undefined) {
      const p = SENSOR_THRESHOLDS.phLevel;
      if (data.phLevel < p.min)
        alerts.push({ field: 'phLevel', value: data.phLevel, threshold: p, status: 'low' as const });
      if (data.phLevel > p.max)
        alerts.push({ field: 'phLevel', value: data.phLevel, threshold: p, status: 'high' as const });
    }

    if (data.feedLevel !== undefined) {
      const f = SENSOR_THRESHOLDS.feedLevel;
      if (data.feedLevel < f.min)
        alerts.push({ field: 'feedLevel', value: data.feedLevel, threshold: f, status: 'low' as const });
    }

    return alerts;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private formatSensorRow(deviceId: string, row: any): SensorReading {
    return {
      deviceId,
      temperature: row.temperature !== undefined ? Number(row.temperature.toFixed(2)) : undefined,
      phLevel:     row.ph_level    !== undefined ? Number(row.ph_level.toFixed(2))    : undefined,
      feedLevel:   row.feed_level  !== undefined ? Number(row.feed_level.toFixed(1))  : undefined,
      lightLevel:  row.light_level !== undefined ? Math.round(row.light_level)        : undefined,
      timestamp:   row._time,
    };
  }

  private getUnit(field: string): string {
    const units: Record<string, string> = {
      temperature: '°C',
      ph_level:    'pH',
      feed_level:  '%',
      light_level: 'lux',
    };
    return units[field] ?? '';
  }
}
