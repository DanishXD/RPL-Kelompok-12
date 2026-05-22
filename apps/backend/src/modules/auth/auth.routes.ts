import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import {
  registerSchema, loginSchema, refreshTokenSchema, type JwtPayload,
} from './auth.schema';

export async function authRoutes(fastify: FastifyInstance) {
  const svc = new AuthService(fastify);

  // POST /api/auth/register
  fastify.post('/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const result = registerSchema.safeParse(req.body);
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
    const data = await svc.register(result.data);
    return reply.status(201).send({ success: true, message: 'Akun berhasil dibuat', data });
  });

  // POST /api/auth/login
  fastify.post('/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const result = loginSchema.safeParse(req.body);
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
    const data = await svc.login(result.data);
    return reply.status(200).send({ success: true, message: 'Login berhasil', data });
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
    const result = refreshTokenSchema.safeParse(req.body);
    if (!result.success) {
      return reply.status(400).send({ success: false, error: 'Refresh token diperlukan' });
    }
    const data = await svc.refreshAccessToken(result.data.refreshToken);
    return reply.status(200).send({ success: true, message: 'Token diperbarui', data });
  });

  // DELETE /api/auth/logout
  fastify.delete('/logout', async (req: FastifyRequest, reply: FastifyReply) => {
    const result = refreshTokenSchema.safeParse(req.body);
    if (!result.success) {
      return reply.status(400).send({ success: false, error: 'Refresh token diperlukan' });
    }
    const data = await svc.logout(result.data.refreshToken);
    return reply.status(200).send({ success: true, data });
  });

  // GET /api/auth/me  (butuh login)
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user as JwtPayload;
      const data = await svc.getProfile(user.sub);
      return reply.status(200).send({ success: true, data });
    }
  );
}
