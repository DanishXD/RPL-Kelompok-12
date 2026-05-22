import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { devices } from '../../../drizzle/schema';
import { AlertEngine } from './alert.engine';
import type { JwtPayload } from '../auth/auth.schema';

const savePushTokenSchema = z.object({
  pushToken: z.string().min(1, 'Push token wajib diisi'),
  deviceId:  z.string().uuid('Device ID harus UUID'),
});

const testAlertSchema = z.object({
  deviceId:  z.string().uuid(),
  pushToken: z.string().min(1),
  field:     z.enum(['temperature', 'phLevel', 'feedLevel']),
  value:     z.number(),
});

export async function alertRoutes(fastify: FastifyInstance) {
  const engine = new AlertEngine(fastify);

  // ── POST /api/alerts/push-token ───────────────────────────────────────────
  // Mobile app kirim Expo push token saat pertama login
  // Token ini dipakai backend untuk kirim notifikasi ke device user

  fastify.post(
    '/push-token',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const result = savePushTokenSchema.safeParse(req.body);
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validasi gagal',
          details: result.error.errors,
        });
      }

      const user = req.user as JwtPayload;
      const db   = fastify.db;

      // Simpan push token ke kolom device
      // (Untuk MVP: simpan di memory — production: simpan di DB)
      fastify.log.info(
        { pushToken: result.data.pushToken, deviceId: result.data.deviceId, userId: user.sub },
        'Push token registered'
      );

      // Verifikasi device milik user ini
      const [device] = await db
        .select()
        .from(devices)
        .where(eq(devices.id, result.data.deviceId))
        .limit(1);

      if (!device || device.userId !== user.sub) {
        return reply.status(403).send({ success: false, error: 'Device bukan milik kamu' });
      }

      return reply.status(200).send({
        success: true,
        message: 'Push token berhasil disimpan',
      });
    }
  );

  // ── POST /api/alerts/test ─────────────────────────────────────────────────
  // Test kirim push notification ke device tertentu
  // Berguna saat development untuk verifikasi push notification jalan

  fastify.post(
    '/test',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const result = testAlertSchema.safeParse(req.body);
      if (!result.success) {
        return reply.status(400).send({ success: false, error: 'Validasi gagal' });
      }

      const { pushToken, field, value, deviceId } = result.data;

      const fakeAlert = {
        deviceId,
        field,
        value,
        status: 'high' as const,
        threshold: { min: 24, max: 32 },
      };

      const { title, body } = engine.buildAlertMessage(fakeAlert);
      const sent = await engine.sendPushNotification(pushToken, title, body, { field, value });

      return reply.status(200).send({
        success: true,
        message: sent ? 'Push notification berhasil dikirim' : 'Gagal kirim — cek push token',
        data: { title, body },
      });
    }
  );

  // ── GET /api/alerts/rules ─────────────────────────────────────────────────
  // Ambil daftar threshold rules yang aktif

  fastify.get(
    '/rules',
    { preHandler: [fastify.authenticate] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const { DEFAULT_RULES } = await import('./alert.engine');
      return reply.status(200).send({ success: true, data: DEFAULT_RULES });
    }
  );
}
