import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { JwtPayload } from '../auth/auth.schema';

// ── In-memory store (cukup untuk MVP) ────────────────────────────────────────
// Production: simpan ke PostgreSQL dengan tabel feeding_schedules

interface Schedule {
  id:       string;
  deviceId: string;
  userId:   string;
  time:     string;           // "07:00"
  amount:   string;           // "100g"
  days:     string[];         // ["everyday"] | ["mon","wed","fri"]
  isActive: boolean;
  note?:    string;
  createdAt: string;
}

const schedules = new Map<string, Schedule>();

// ── Schemas ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  deviceId: z.string().uuid(),
  time:     z.string().regex(/^\d{2}:\d{2}$/, 'Format waktu harus HH:MM'),
  amount:   z.string().min(1),
  days:     z.array(z.string()).min(1),
  isActive: z.boolean().optional().default(true),
  note:     z.string().optional(),
});

const updateSchema = z.object({
  time:     z.string().regex(/^\d{2}:\d{2}$/).optional(),
  amount:   z.string().min(1).optional(),
  days:     z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
  note:     z.string().optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export async function schedulesRoutes(fastify: FastifyInstance) {

  // GET /api/schedules?deviceId=xxx
  fastify.get('/', { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user     = req.user as JwtPayload;
      const { deviceId } = req.query as { deviceId?: string };
      if (!deviceId) return reply.status(400).send({ success: false, error: 'deviceId wajib diisi' });

      const result = Array.from(schedules.values())
        .filter(s => s.deviceId === deviceId && s.userId === user.sub)
        .sort((a, b) => a.time.localeCompare(b.time));

      return reply.send({ success: true, data: result });
    }
  );

  // POST /api/schedules
  fastify.post('/', { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user   = req.user as JwtPayload;
      const result = createSchema.safeParse(req.body);
      if (!result.success) return reply.status(400).send({ success: false, error: 'Validasi gagal', details: result.error.errors });

      const schedule: Schedule = {
        id:        crypto.randomUUID(),
        userId:    user.sub,
        deviceId:  result.data.deviceId,
        time:      result.data.time,
        amount:    result.data.amount,
        days:      result.data.days,
        isActive:  result.data.isActive ?? true,
        note:      result.data.note,
        createdAt: new Date().toISOString(),
      };
      schedules.set(schedule.id, schedule);
      fastify.log.info({ scheduleId: schedule.id }, 'Schedule created');
      return reply.status(201).send({ success: true, data: schedule });
    }
  );

  // PATCH /api/schedules/:id
  fastify.patch('/:id', { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user   = req.user as JwtPayload;
      const { id } = req.params as { id: string };
      const existing = schedules.get(id);
      if (!existing || existing.userId !== user.sub) {
        return reply.status(404).send({ success: false, error: 'Jadwal tidak ditemukan' });
      }
      const result = updateSchema.safeParse(req.body);
      if (!result.success) return reply.status(400).send({ success: false, error: 'Validasi gagal' });

      const updated: Schedule = { ...existing, ...result.data };
      schedules.set(id, updated);
      return reply.send({ success: true, data: updated });
    }
  );

  // DELETE /api/schedules/:id
  fastify.delete('/:id', { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user   = req.user as JwtPayload;
      const { id } = req.params as { id: string };
      const existing = schedules.get(id);
      if (!existing || existing.userId !== user.sub) {
        return reply.status(404).send({ success: false, error: 'Jadwal tidak ditemukan' });
      }
      schedules.delete(id);
      return reply.send({ success: true, message: 'Jadwal berhasil dihapus' });
    }
  );
}
