import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IotService } from './iot.service';
import { sensorDataSchema } from './iot.schema';
import type { JwtPayload } from '../auth/auth.schema';

export async function iotRoutes(fastify: FastifyInstance) {
  const svc = new IotService(fastify);

  fastify.post('/ingest', async (req, reply) => {
    const r = sensorDataSchema.safeParse(req.body);
    if (!r.success) return reply.status(400).send({ success: false, error: 'Validasi gagal', details: r.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) });
    await svc.verifyDevice(r.data.deviceId, r.data.deviceToken);
    await svc.saveSensorData(r.data);
    const alerts = svc.checkThresholds(r.data);
    if (alerts.length > 0) {
      fastify.io.to(`device:${r.data.deviceId}`).emit('alert:triggered', { deviceId: r.data.deviceId, alerts, timestamp: new Date().toISOString() });
    }
    return reply.status(201).send({ success: true, message: 'Data sensor tersimpan', data: { saved: true, alerts: alerts.length } });
  });

  fastify.get('/sensors/latest', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { deviceId } = req.query as { deviceId?: string };
    if (!deviceId) return reply.status(400).send({ success: false, error: 'deviceId wajib diisi' });
    const data = await svc.getLatestSensorData(deviceId);
    return reply.status(200).send({ success: true, data });
  });

  fastify.get('/sensors/history', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { deviceId, range, field } = req.query as { deviceId?: string; range?: '1h'|'24h'|'7d'|'30d'; field?: string };
    if (!deviceId) return reply.status(400).send({ success: false, error: 'deviceId wajib diisi' });
    const validRange = (['1h','24h','7d','30d'] as const).includes(range as any) ? range! : '24h';
    const data = await svc.getSensorHistory(deviceId, validRange, field);
    return reply.status(200).send({ success: true, data, meta: { deviceId, range: validRange, points: data.length } });
  });
}
