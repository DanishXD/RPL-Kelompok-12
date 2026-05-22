import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { devices } from '../../../drizzle/schema';
import type { JwtPayload } from '../auth/auth.schema';

const createDeviceSchema = z.object({
  name:     z.string().min(2, 'Nama device minimal 2 karakter').max(100),
  location: z.string().max(200).optional(),
});

export async function devicesRoutes(fastify: FastifyInstance) {

  // ── POST /api/devices — Daftarkan device ESP32 baru ──────────────────────
  // Butuh login user. Response berisi deviceToken untuk dimasukkan ke config.h ESP32

  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user   = req.user as JwtPayload;
      const result = createDeviceSchema.safeParse(req.body);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validasi gagal',
          details: result.error.errors.map(e => ({
            field:   e.path.join('.'),
            message: e.message,
          })),
        });
      }

      const db = fastify.db;

      // Generate token unik untuk device ini
      const deviceToken = crypto.randomBytes(32).toString('hex');

      const [newDevice] = await db
        .insert(devices)
        .values({
          name:        result.data.name,
          userId:      user.sub,
          deviceToken,
          location:    result.data.location,
          status:      'active',
        })
        .returning();

      return reply.status(201).send({
        success: true,
        message: 'Device berhasil didaftarkan',
        data: {
          id:          newDevice.id,
          name:        newDevice.name,
          location:    newDevice.location,
          status:      newDevice.status,
          deviceToken, // Salin ini ke config.h ESP32 — hanya tampil sekali!
          createdAt:   newDevice.createdAt,
        },
      });
    }
  );

  // ── GET /api/devices — List semua device milik user ───────────────────────

  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user as JwtPayload;
      const db   = fastify.db;

      const userDevices = await db
        .select({
          id:         devices.id,
          name:       devices.name,
          status:     devices.status,
          location:   devices.location,
          lastSeenAt: devices.lastSeenAt,
          createdAt:  devices.createdAt,
        })
        .from(devices)
        .where(eq(devices.userId, user.sub));

      return reply.status(200).send({ success: true, data: userDevices });
    }
  );

  // ── DELETE /api/devices/:id — Hapus device ────────────────────────────────

  fastify.delete(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user     = req.user as JwtPayload;
      const { id }   = req.params as { id: string };
      const db       = fastify.db;

      const deleted = await db
        .delete(devices)
        .where(and(eq(devices.id, id), eq(devices.userId, user.sub)))
        .returning({ id: devices.id });

      if (deleted.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Device tidak ditemukan atau bukan milik kamu',
        });
      }

      return reply.status(200).send({ success: true, message: 'Device berhasil dihapus' });
    }
  );
}
