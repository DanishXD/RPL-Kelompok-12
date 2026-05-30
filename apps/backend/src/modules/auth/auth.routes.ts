import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema, refreshTokenSchema, type JwtPayload } from './auth.schema';

export async function authRoutes(fastify: FastifyInstance) {
  const svc = new AuthService(fastify);

  fastify.post('/register', async (req, reply) => {
    const r = registerSchema.safeParse(req.body);
    if (!r.success) return reply.status(400).send({ success: false, error: 'Validasi gagal', details: r.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) });
    const data = await svc.register(r.data);
    return reply.status(201).send({ success: true, message: 'Akun berhasil dibuat', data });
  });

  fastify.post('/login', async (req, reply) => {
    const r = loginSchema.safeParse(req.body);
    if (!r.success) return reply.status(400).send({ success: false, error: 'Validasi gagal', details: r.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) });
    const data = await svc.login(r.data);
    return reply.status(200).send({ success: true, message: 'Login berhasil', data });
  });

  fastify.post('/refresh', async (req, reply) => {
    const r = refreshTokenSchema.safeParse(req.body);
    if (!r.success) return reply.status(400).send({ success: false, error: 'Refresh token diperlukan' });
    const data = await svc.refreshAccessToken(r.data.refreshToken);
    return reply.status(200).send({ success: true, data });
  });

  fastify.delete('/logout', async (req, reply) => {
    const r = refreshTokenSchema.safeParse(req.body);
    if (!r.success) return reply.status(400).send({ success: false, error: 'Refresh token diperlukan' });
    const data = await svc.logout(r.data.refreshToken);
    return reply.status(200).send({ success: true, data });
  });

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const data = await svc.getProfile(user.sub);
    return reply.status(200).send({ success: true, data });
  });
}
