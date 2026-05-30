import { Point } from '@influxdata/influxdb-client';
import { eq } from 'drizzle-orm';
import { FastifyInstance } from 'fastify';
import { devices } from '../../../drizzle/schema';
import type { SensorDataInput, SensorReading } from './iot.schema';
import { SENSOR_THRESHOLDS } from './iot.schema';

export class IotService {
  constructor(private fastify: FastifyInstance) {}

  async verifyDevice(deviceId: string, deviceToken: string) {
    const db = this.fastify.db;
    const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
    if (!device) throw { statusCode: 404, message: 'Device tidak ditemukan' };
    if (device.deviceToken !== deviceToken) throw { statusCode: 401, message: 'Device token tidak valid' };
    if (device.status === 'inactive') throw { statusCode: 403, message: 'Device tidak aktif' };
    await db.update(devices).set({ lastSeenAt: new Date() }).where(eq(devices.id, deviceId));
    return device;
  }

  async saveSensorData(data: SensorDataInput): Promise<void> {
    const { writePoint, flush } = this.fastify.influx;
    // Jika InfluxDB tidak tersedia (writePoint fungsi dummy atau null), lewati
    if (!writePoint) {
      this.fastify.log.warn('InfluxDB writePoint tidak tersedia, data sensor tidak disimpan');
      return;
    }
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    const point = new Point('sensor_readings').tag('device_id', data.deviceId).timestamp(timestamp);
    if (data.temperature !== undefined) point.floatField('temperature', data.temperature);
    if (data.phLevel     !== undefined) point.floatField('ph_level',    data.phLevel);
    if (data.feedLevel   !== undefined) point.floatField('feed_level',  data.feedLevel);
    if (data.lightLevel  !== undefined) point.intField('light_level', Math.round(data.lightLevel));
    writePoint(point);
    await flush();
  }

  async getLatestSensorData(deviceId: string): Promise<SensorReading> {
    const { queryApi } = this.fastify.influx;
    if (!queryApi) {
      this.fastify.log.warn('InfluxDB queryApi tidak tersedia');
      throw { statusCode: 503, message: 'Layanan sensor tidak tersedia saat ini' };
    }
    const bucket = process.env.INFLUXDB_BUCKET ?? 'sensors';
    const query = `from(bucket:"${bucket}")|>range(start:-24h)|>filter(fn:(r)=>r["_measurement"]=="sensor_readings")|>filter(fn:(r)=>r["device_id"]=="${deviceId}")|>last()|>pivot(rowKey:["_time"],columnKey:["_field"],valueColumn:"_value")`;
    const rows = await queryApi.collectRows<any>(query);
    if (rows.length === 0) throw { statusCode: 404, message: 'Belum ada data sensor' };
    const row = rows[0];
    return {
      deviceId,
      temperature: row.temperature !== undefined ? Number(row.temperature.toFixed(2)) : undefined,
      phLevel:     row.ph_level    !== undefined ? Number(row.ph_level.toFixed(2))    : undefined,
      feedLevel:   row.feed_level  !== undefined ? Number(row.feed_level.toFixed(1))  : undefined,
      lightLevel:  row.light_level !== undefined ? Math.round(row.light_level)        : undefined,
      timestamp:   row._time,
    };
  }

  async getSensorHistory(deviceId: string, range: '1h'|'24h'|'7d'|'30d' = '24h', field?: string) {
    const { queryApi } = this.fastify.influx;
    if (!queryApi) {
      this.fastify.log.warn('InfluxDB queryApi tidak tersedia, mengembalikan history kosong');
      return [];
    }
    const bucket = process.env.INFLUXDB_BUCKET ?? 'sensors';
    const windowMap = { '1h':'1m', '24h':'30m', '7d':'3h', '30d':'1d' };
    const fieldFilter = field ? `|>filter(fn:(r)=>r["_field"]=="${field}")` : '';
    const query = `from(bucket:"${bucket}")|>range(start:-${range})|>filter(fn:(r)=>r["_measurement"]=="sensor_readings")|>filter(fn:(r)=>r["device_id"]=="${deviceId}")${fieldFilter}|>aggregateWindow(every:${windowMap[range]},fn:mean,createEmpty:false)|>pivot(rowKey:["_time"],columnKey:["_field"],valueColumn:"_value")|>sort(columns:["_time"])`;
    const rows = await queryApi.collectRows<any>(query);
    return rows.map((row: any) => ({
      time:        row._time,
      temperature: row.temperature !== undefined ? Number(row.temperature.toFixed(2)) : undefined,
      phLevel:     row.ph_level    !== undefined ? Number(row.ph_level.toFixed(2))    : undefined,
      feedLevel:   row.feed_level  !== undefined ? Number(row.feed_level.toFixed(1))  : undefined,
      lightLevel:  row.light_level !== undefined ? Math.round(row.light_level)        : undefined,
    }));
  }

  checkThresholds(data: SensorDataInput) {
    const alerts = [];
    if (data.temperature !== undefined) {
      const t = SENSOR_THRESHOLDS.temperature;
      if (data.temperature < t.min) alerts.push({ field: 'temperature', value: data.temperature, threshold: t, status: 'low' as const });
      if (data.temperature > t.max) alerts.push({ field: 'temperature', value: data.temperature, threshold: t, status: 'high' as const });
    }
    if (data.phLevel !== undefined) {
      const p = SENSOR_THRESHOLDS.phLevel;
      if (data.phLevel < p.min) alerts.push({ field: 'phLevel', value: data.phLevel, threshold: p, status: 'low' as const });
      if (data.phLevel > p.max) alerts.push({ field: 'phLevel', value: data.phLevel, threshold: p, status: 'high' as const });
    }
    if (data.feedLevel !== undefined) {
      const f = SENSOR_THRESHOLDS.feedLevel;
      if (data.feedLevel < f.min) alerts.push({ field: 'feedLevel', value: data.feedLevel, threshold: f, status: 'low' as const });
    }
    return alerts;
  }
}