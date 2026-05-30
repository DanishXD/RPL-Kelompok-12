import 'dotenv/config';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import { FastifyRequest, FastifyReply } from 'fastify';
import dbPlugin          from './plugins/db';
import influxPlugin      from './plugins/influx';
import socketPlugin      from './plugins/socket';
import { authRoutes }    from './modules/auth/auth.routes';
import { iotRoutes }     from './modules/iot/iot.routes';
import { devicesRoutes } from './modules/devices/devices.routes';
import { alertRoutes }   from './modules/alerts/alert.routes';
import { chatRoutes }    from './modules/chat/chat.routes';
import { startMqttBridge } from './modules/iot/mqtt.bridge';

declare module 'fastify' {
  interface FastifyInstance { authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>; }
}

async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
    },
  });
  await fastify.register(fastifyCors, { origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] });
  await fastify.register(fastifyJwt as any, { secret: process.env.JWT_SECRET!, sign: { issuer: 'ecosmart-feeder', audience: 'ecosmart-app' }, verify: { issuer: 'ecosmart-feeder', audience: 'ecosmart-app' } });
  await fastify.register(dbPlugin);
  await fastify.register(influxPlugin);
  await fastify.register(socketPlugin);
  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try { await req.jwtVerify(); }
    catch { return reply.status(401).send({ success: false, error: 'Token tidak valid atau expired.' }); }
  });
  await fastify.register(authRoutes,    { prefix: '/api/auth'    });
  await fastify.register(iotRoutes,     { prefix: '/api/iot'     });
  await fastify.register(devicesRoutes, { prefix: '/api/devices' });
  await fastify.register(alertRoutes,   { prefix: '/api/alerts'  });
  await fastify.register(chatRoutes,    { prefix: '/api/chat'    });
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString(), service: 'EcoSmart Feeder API', version: '5.0.0' }));
  fastify.setErrorHandler((error, _req, reply) => {
    fastify.log.error(error);
    if ((error as any).statusCode) return reply.status((error as any).statusCode).send({ success: false, error: error.message });
    return reply.status(500).send({ success: false, error: 'Terjadi kesalahan pada server.' });
  });
  return fastify;
}

async function start() {
  const app  = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  try {
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 EcoSmart API  →  http://localhost:${port}`);
    console.log(`❤️  Health        →  http://localhost:${port}/health`);
    console.log(`🔌 WebSocket     →  ws://localhost:${port}`);
    console.log(`🤖 AI Chat       →  POST http://localhost:${port}/api/chat/message\n`);
    await startMqttBridge(app);
  } catch (err) { app.log.error(err); process.exit(1); }
}
start();
