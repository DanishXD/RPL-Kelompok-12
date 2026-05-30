import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { devices } from '../../../drizzle/schema';
import type { JwtPayload } from '../auth/auth.schema';

const createDeviceSchema = z.object({
  name:     z.string().min(2).max(100),
  location: z.string().max(200).optional(),
});

export async function devicesRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const r    = createDeviceSchema.safeParse(req.body);
    if (!r.success) return reply.status(400).send({ success: false, error: 'Validasi gagal', details: r.error.errors });
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const [newDevice] = await fastify.db.insert(devices).values({ name: r.data.name, userId: user.sub, deviceToken, location: r.data.location, status: 'active' }).returning();
    return reply.status(201).send({ success: true, message: 'Device berhasil didaftarkan', data: { id: newDevice.id, name: newDevice.name, location: newDevice.location, status: newDevice.status, deviceToken, createdAt: newDevice.createdAt } });
  });

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user        = req.user as JwtPayload;
    const userDevices = await fastify.db.select({ id: devices.id, name: devices.name, status: devices.status, location: devices.location, lastSeenAt: devices.lastSeenAt, createdAt: devices.createdAt }).from(devices).where(eq(devices.userId, user.sub));
    return reply.status(200).send({ success: true, data: userDevices });
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user   = req.user as JwtPayload;
    const { id } = req.params as { id: string };
    const deleted = await fastify.db.delete(devices).where(and(eq(devices.id, id), eq(devices.userId, user.sub))).returning({ id: devices.id });
    if (deleted.length === 0) return reply.status(404).send({ success: false, error: 'Device tidak ditemukan' });
    return reply.status(200).send({ success: true, message: 'Device berhasil dihapus' });
  });
}
