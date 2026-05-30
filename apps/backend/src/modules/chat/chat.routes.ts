import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ChatService } from './chat.service';
import { sendMessageSchema } from './chat.schema';
import type { JwtPayload } from '../auth/auth.schema';

export async function chatRoutes(fastify: FastifyInstance) {
  const svc = new ChatService(fastify);

  fastify.post('/message', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const r = sendMessageSchema.safeParse(req.body);
    if (!r.success) return reply.status(400).send({ success: false, error: 'Validasi gagal', details: r.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) });
    const user = req.user as JwtPayload;
    const { reply: aiReply, sessionId, sensorContext } = await svc.sendMessage(user.sub, r.data.message, r.data.deviceId, r.data.sessionId);
    return reply.status(200).send({ success: true, data: { reply: aiReply, sessionId, sensorContext: sensorContext ?? null, timestamp: new Date().toISOString() } });
  });

  fastify.get('/history/:sessionId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const { sessionId } = req.params as { sessionId: string };
    const messages = svc.getHistory(user.sub, sessionId);
    return reply.status(200).send({ success: true, data: { sessionId, messages } });
  });

  fastify.get('/sessions', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user     = req.user as JwtPayload;
    const sessions = svc.getUserSessions(user.sub);
    return reply.status(200).send({ success: true, data: sessions });
  });

  fastify.delete('/session/:sessionId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    svc.clearSession(sessionId);
    return reply.status(200).send({ success: true, message: 'Session berhasil dihapus' });
  });
}
