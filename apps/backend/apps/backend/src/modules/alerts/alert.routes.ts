import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { devices } from '../../../drizzle/schema';
import { AlertEngine, DEFAULT_RULES } from './alert.engine';
import type { JwtPayload } from '../auth/auth.schema';

const savePushTokenSchema = z.object({ pushToken: z.string().min(1), deviceId: z.string().uuid() });
const testAlertSchema     = z.object({ deviceId: z.string().uuid(), pushToken: z.string().min(1), field: z.enum(['temperature', 'phLevel', 'feedLevel']), value: z.number() });

export async function alertRoutes(fastify: FastifyInstance) {
  const engine = new AlertEngine(fastify);

  fastify.post('/push-token', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const r    = savePushTokenSchema.safeParse(req.body);
    if (!r.success) return reply.status(400).send({ success: false, error: 'Validasi gagal' });
    const [device] = await fastify.db.select().from(devices).where(eq(devices.id, r.data.deviceId)).limit(1);
    if (!device || device.userId !== user.sub) return reply.status(403).send({ success: false, error: 'Device bukan milik kamu' });
    fastify.log.info({ pushToken: r.data.pushToken, deviceId: r.data.deviceId }, 'Push token registered');
    return reply.status(200).send({ success: true, message: 'Push token berhasil disimpan' });
  });

  fastify.post('/test', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const r = testAlertSchema.safeParse(req.body);
    if (!r.success) return reply.status(400).send({ success: false, error: 'Validasi gagal' });
    const fakeAlert = { deviceId: r.data.deviceId, field: r.data.field, value: r.data.value, status: 'high' as const, threshold: { min: 24, max: 32 } };
    const { title, body } = engine.buildAlertMessage(fakeAlert);
    const sent = await engine.sendPushNotification(r.data.pushToken, title, body, { field: r.data.field, value: r.data.value });
    return reply.status(200).send({ success: true, message: sent ? 'Notifikasi terkirim' : 'Gagal kirim', data: { title, body } });
  });

  fastify.get('/rules', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(200).send({ success: true, data: DEFAULT_RULES });
  });
}
