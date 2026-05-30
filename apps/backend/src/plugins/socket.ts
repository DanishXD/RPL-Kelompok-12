import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';

declare module 'fastify' {
  interface FastifyInstance { io: SocketIOServer; }
}

export const SOCKET_EVENTS = {
  SENSOR_UPDATE:    'sensor:update',
  ALERT_TRIGGERED:  'alert:triggered',
  DEVICE_STATUS:    'device:status',
  FEED_EXECUTED:    'feed:executed',
  JOIN_DEVICE_ROOM: 'join:device',
  LEAVE_DEVICE_ROOM:'leave:device',
  REQUEST_LATEST:   'request:latest',
} as const;

export default fp(async (fastify: FastifyInstance) => {
  const io = new SocketIOServer(fastify.server as HttpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 20000, pingInterval: 10000,
  });
  io.on('connection', (socket) => {
    fastify.log.info(`🔌 Client connected: ${socket.id}`);
    socket.on(SOCKET_EVENTS.JOIN_DEVICE_ROOM, (deviceId: string) => {
      socket.join(`device:${deviceId}`);
      socket.emit('joined', { deviceId });
    });
    socket.on(SOCKET_EVENTS.LEAVE_DEVICE_ROOM, (deviceId: string) => {
      socket.leave(`device:${deviceId}`);
    });
    socket.on(SOCKET_EVENTS.REQUEST_LATEST, async (deviceId: string) => {
      try {
        const { IotService } = await import('../modules/iot/iot.service');
        const svc  = new IotService(fastify);
        const data = await svc.getLatestSensorData(deviceId);
        socket.emit(SOCKET_EVENTS.SENSOR_UPDATE, data);
      } catch { socket.emit('error', { message: 'Gagal ambil data sensor' }); }
    });
    socket.on('disconnect', (reason) => {
      fastify.log.info(`Client disconnected: ${socket.id} — ${reason}`);
    });
  });
  fastify.decorate('io', io);
  fastify.addHook('onClose', async () => { io.close(); });
});
