import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IotService } from './iot.service';
import { sensorDataSchema } from './iot.schema';
import { AlertEngine } from '../alerts/alert.engine';

export async function iotRoutes(fastify: FastifyInstance) {
  const svc    = new IotService(fastify);
  const engine = new AlertEngine(fastify);

  // ── POST /api/iot/ingest ──────────────────────────────────────────────────
  // Endpoint untuk ESP32 kirim data sensor via HTTP
  // (Alternatif dari MQTT — lebih mudah untuk testing awal)
  //
  // Body: { deviceId, deviceToken, temperature, phLevel, feedLevel, lightLevel }
  // Tidak butuh JWT user — autentikasi pakai deviceToken

  fastify.post('/ingest', async (req: FastifyRequest, reply: FastifyReply) => {
    const result = sensorDataSchema.safeParse(req.body);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validasi gagal',
        details: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    // 1. Verifikasi device
    await svc.verifyDevice(result.data.deviceId, result.data.deviceToken);

    // 2. Simpan ke InfluxDB
    await svc.saveSensorData(result.data);

    // 3. Broadcast sensor update ke mobile via WebSocket
    fastify.io
      .to(`device:${result.data.deviceId}`)
      .emit('sensor:update', {
        deviceId:    result.data.deviceId,
        temperature: result.data.temperature,
        phLevel:     result.data.phLevel,
        feedLevel:   result.data.feedLevel,
        lightLevel:  result.data.lightLevel,
        timestamp:   new Date().toISOString(),
      });

    // 4. Cek threshold & kirim alert via WebSocket kalau ada yang terlewati
    const triggered = engine.checkAndFire(result.data.deviceId, {
      temperature: result.data.temperature,
      phLevel:     result.data.phLevel,
      feedLevel:   result.data.feedLevel,
    });

    return reply.status(201).send({
      success: true,
      message: 'Data sensor berhasil disimpan',
      data: {
        saved:        true,
        alerts:       triggered.length,
        alertDetails: triggered.length > 0 ? triggered : undefined,
      },
    });
  });

  // ── POST /api/iot/test-alert ──────────────────────────────────────────────
  // Test kirim alert ke mobile tanpa sensor fisik
  // Berguna saat development untuk verifikasi notifikasi jalan
  // Butuh login user (JWT)
  //
  // Body: { deviceId, temperature?, phLevel?, feedLevel?, lightLevel? }
  // Kirim nilai yang sengaja melewati threshold untuk trigger alert

  fastify.post(
    '/test-alert',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { deviceId, temperature, phLevel, feedLevel, lightLevel } = req.body as {
        deviceId:     string;
        temperature?: number;
        phLevel?:     number;
        feedLevel?:   number;
        lightLevel?:  number;
      };

      if (!deviceId) {
        return reply.status(400).send({ success: false, error: 'deviceId wajib diisi' });
      }

      const sensorPayload = {
        deviceId,
        temperature,
        phLevel,
        feedLevel,
        lightLevel,
        timestamp: new Date().toISOString(),
      };

      // Broadcast ke room device — untuk client yang sudah join
      fastify.io
        .to(`device:${deviceId}`)
        .emit('sensor:update', sensorPayload);

      // Broadcast juga ke semua client — fallback untuk development/testing
      fastify.io.emit('sensor:update', sensorPayload);

      // Cek threshold & kirim alert:triggered ke mobile
      const triggered = engine.checkAndFire(deviceId, {
        temperature,
        phLevel,
        feedLevel,
      });

      return reply.status(200).send({
        success: true,
        message: triggered.length > 0
          ? `${triggered.length} alert dikirim ke mobile`
          : 'Tidak ada threshold yang terlewati — coba nilai yang lebih ekstrem',
        data: { triggered },
      });
    }
  );


  // ── GET /api/iot/sensors/latest?deviceId=xxx ──────────────────────────────
  // Ambil data sensor terbaru untuk satu device
  // Butuh login user (JWT)

  fastify.get(
    '/sensors/latest',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { deviceId } = req.query as { deviceId?: string };

      if (!deviceId) {
        return reply.status(400).send({
          success: false,
          error: 'Parameter deviceId wajib diisi',
        });
      }

      const data = await svc.getLatestSensorData(deviceId);

      return reply.status(200).send({ success: true, data });
    }
  );

  // ── GET /api/iot/sensors/history?deviceId=xxx&range=24h&field=temperature ─
  // Ambil data historis untuk grafik
  // range: 1h | 24h | 7d | 30d
  // field: temperature | ph_level | feed_level | light_level (opsional)

  fastify.get(
    '/sensors/history',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { deviceId, range, field } = req.query as {
        deviceId?: string;
        range?: '1h' | '24h' | '7d' | '30d';
        field?: string;
      };

      if (!deviceId) {
        return reply.status(400).send({
          success: false,
          error: 'Parameter deviceId wajib diisi',
        });
      }

      const validRanges = ['1h', '24h', '7d', '30d'];
      const selectedRange = validRanges.includes(range ?? '') ? range! : '24h';

      const data = await svc.getSensorHistory(deviceId, selectedRange, field);

      return reply.status(200).send({
        success: true,
        data,
        meta: { deviceId, range: selectedRange, points: data.length },
      });
    }
  );

  // ── GET /api/iot/sensors/stats?deviceId=xxx&range=24h ────────────────────
  // Statistik ringkasan: avg, min, max, last per sensor

  fastify.get(
    '/sensors/stats',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { deviceId, range } = req.query as {
        deviceId?: string;
        range?: '24h' | '7d' | '30d';
      };

      if (!deviceId) {
        return reply.status(400).send({
          success: false,
          error: 'Parameter deviceId wajib diisi',
        });
      }

      const data = await svc.getSensorStats(
        deviceId,
        (['24h', '7d', '30d'].includes(range ?? '') ? range : '24h') as any
      );

      return reply.status(200).send({ success: true, data });
    }
  );
}
