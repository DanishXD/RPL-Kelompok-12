import mqtt, { MqttClient } from 'mqtt';
import { FastifyInstance } from 'fastify';
import { IotService } from './iot.service';
import { mqttPayloadSchema } from './iot.schema';
import { SOCKET_EVENTS } from '../../plugins/socket';
import { AlertEngine } from '../alerts/alert.engine';

const TOPIC_SENSORS = 'ecosmart/+/sensors';
const TOPIC_STATUS  = 'ecosmart/+/status';

let mqttClient: MqttClient | null = null;

export async function startMqttBridge(fastify: FastifyInstance): Promise<void> {
  const brokerUrl  = process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883';
  const clientId   = process.env.MQTT_CLIENT_ID  ?? 'ecosmart-backend';
  const iotService  = new IotService(fastify);
  const alertEngine = new AlertEngine(fastify);

  mqttClient = mqtt.connect(brokerUrl, {
    clientId: `${clientId}-${Date.now()}`,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    keepalive: 60,
  });

  mqttClient.on('connect', () => {
    fastify.log.info('✅ MQTT broker connected');
    mqttClient!.subscribe([TOPIC_SENSORS, TOPIC_STATUS], { qos: 1 }, (err) => {
      if (err) fastify.log.error({ err }, 'Failed to subscribe MQTT topics');
      else fastify.log.info(`Subscribed: ${TOPIC_SENSORS}, ${TOPIC_STATUS}`);
    });
  });

  mqttClient.on('message', async (topic: string, payload: Buffer) => {
    try {
      const parts    = topic.split('/');
      const deviceId = parts[1];
      const type     = parts[2];
      if (!deviceId) return;

      const parsed = JSON.parse(payload.toString());

      if (type === 'sensors') {
        const result = mqttPayloadSchema.safeParse(parsed);
        if (!result.success) {
          fastify.log.warn({ deviceId }, 'Invalid MQTT payload');
          return;
        }

        try {
          await iotService.verifyDevice(deviceId, result.data.deviceToken);

          const sensorData = {
            deviceId,
            deviceToken: result.data.deviceToken,
            temperature: result.data.temperature,
            phLevel:     result.data.phLevel,
            feedLevel:   result.data.feedLevel,
            lightLevel:  result.data.lightLevel,
            timestamp:   result.data.timestamp,
          };

          // 1. Simpan ke InfluxDB
          await iotService.saveSensorData(sensorData);

          // 2. Broadcast real-time ke mobile via WebSocket
          fastify.io.to(`device:${deviceId}`).emit(SOCKET_EVENTS.SENSOR_UPDATE, {
            deviceId,
            temperature: result.data.temperature,
            phLevel:     result.data.phLevel,
            feedLevel:   result.data.feedLevel,
            lightLevel:  result.data.lightLevel,
            timestamp:   result.data.timestamp ?? new Date().toISOString(),
          });

          // 3. Cek threshold dan fire alert jika perlu
          alertEngine.checkAndFire(deviceId, {
            temperature: result.data.temperature,
            phLevel:     result.data.phLevel,
            feedLevel:   result.data.feedLevel,
          });

        } catch (err: any) {
          fastify.log.error({ err: err.message, deviceId }, 'Failed to process MQTT data');
        }
      }

      if (type === 'status') {
        fastify.io.to(`device:${deviceId}`).emit(SOCKET_EVENTS.DEVICE_STATUS, {
          deviceId, ...parsed, timestamp: new Date().toISOString(),
        });
      }

    } catch (err) {
      fastify.log.error({ err, topic }, 'MQTT message error');
    }
  });

  mqttClient.on('error',     (err) => fastify.log.error({ err }, 'MQTT error'));
  mqttClient.on('reconnect', ()    => fastify.log.warn('MQTT reconnecting...'));
  mqttClient.on('close',     ()    => fastify.log.warn('MQTT connection closed'));

  fastify.addHook('onClose', async () => {
    if (mqttClient?.connected) {
      mqttClient.end(true);
      fastify.log.info('MQTT client disconnected');
    }
  });
}

export function publishToDevice(
  deviceId: string, command: string, payload: object
): void {
  if (!mqttClient?.connected) throw new Error('MQTT client not connected');
  mqttClient.publish(
    `ecosmart/${deviceId}/commands`,
    JSON.stringify({ command, ...payload }),
    { qos: 1 }
  );
}
