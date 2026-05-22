import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';

// ── Extend FastifyInstance ────────────────────────────────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

// ── Event names (shared dengan mobile) ───────────────────────────────────────
export const SOCKET_EVENTS = {
  // Server → Client
  SENSOR_UPDATE:    'sensor:update',
  ALERT_TRIGGERED:  'alert:triggered',
  DEVICE_STATUS:    'device:status',
  FEED_EXECUTED:    'feed:executed',

  // Client → Server
  JOIN_DEVICE_ROOM: 'join:device',
  LEAVE_DEVICE_ROOM:'leave:device',
  REQUEST_LATEST:   'request:latest',
} as const;

export default fp(async (fastify: FastifyInstance) => {
  // Buat Socket.io server nempel ke HTTP server Fastify
  const io = new SocketIOServer(fastify.server as HttpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout:  20000,
    pingInterval: 10000,
  });

  // ── Connection handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    fastify.log.info(`🔌 Client connected: ${socket.id}`);

    // Client join room berdasarkan deviceId
    // Setiap device punya "room" sendiri — broadcast hanya ke client yang punya device itu
    socket.on(SOCKET_EVENTS.JOIN_DEVICE_ROOM, (deviceId: string) => {
      socket.join(`device:${deviceId}`);
      fastify.log.info(`Client ${socket.id} joined room: device:${deviceId}`);
      socket.emit('joined', { deviceId, message: 'Berhasil join room device' });
    });

    // Client leave room
    socket.on(SOCKET_EVENTS.LEAVE_DEVICE_ROOM, (deviceId: string) => {
      socket.leave(`device:${deviceId}`);
      fastify.log.info(`Client ${socket.id} left room: device:${deviceId}`);
    });

    // Client minta data terbaru (misal saat buka app)
    socket.on(SOCKET_EVENTS.REQUEST_LATEST, async (deviceId: string) => {
      try {
        const { IotService } = await import('../modules/iot/iot.service');
        const svc  = new IotService(fastify);
        const data = await svc.getLatestSensorData(deviceId);
        socket.emit(SOCKET_EVENTS.SENSOR_UPDATE, data);
      } catch (err: any) {
        // 404 = belum ada data di InfluxDB — normal saat pertama kali, cukup log saja
        if (err?.statusCode === 404) {
          fastify.log.info(`No sensor data yet for device ${deviceId}`);
        } else {
          fastify.log.error({ err }, 'Failed to fetch latest sensor data');
        }
        // Jangan emit error ke client — biarkan mobile tetap menunggu data real-time
      }
    });

    socket.on('disconnect', (reason) => {
      fastify.log.info(`Client disconnected: ${socket.id} — ${reason}`);
    });
  });

  fastify.decorate('io', io);

  fastify.addHook('onClose', async () => {
    io.close();
    fastify.log.info('Socket.io server closed');
  });
});
