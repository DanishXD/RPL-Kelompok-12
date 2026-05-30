import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { FastifyInstance } from 'fastify';
import { SOCKET_EVENTS } from '../../plugins/socket';

export interface AlertPayload { deviceId: string; field: string; value: number; status: 'low' | 'high'; threshold: { min: number; max: number }; }
export interface AlertRule    { field: string; label: string; unit: string; min: number; max: number; dangerMin: number; dangerMax: number; }

export const DEFAULT_RULES: AlertRule[] = [
  { field: 'temperature', label: 'Suhu Air',    unit: '°C', min: 24,  max: 32,  dangerMin: 20,  dangerMax: 36  },
  { field: 'phLevel',     label: 'pH Air',      unit: '',   min: 6.5, max: 8.5, dangerMin: 5.5, dangerMax: 9.5 },
  { field: 'feedLevel',   label: 'Level Pakan', unit: '%',  min: 20,  max: 100, dangerMin: 10,  dangerMax: 100 },
];

const expo = new Expo({ useFcmV1: false });

export class AlertEngine {
  constructor(private fastify: FastifyInstance) {}

  checkAndFire(deviceId: string, sensorData: Record<string, number | undefined>) {
    const triggered: AlertPayload[] = [];
    for (const rule of DEFAULT_RULES) {
      const value = sensorData[rule.field];
      if (value === undefined) continue;
      if (value < rule.min) triggered.push({ deviceId, field: rule.field, value, status: 'low',  threshold: { min: rule.min, max: rule.max } });
      if (value > rule.max) triggered.push({ deviceId, field: rule.field, value, status: 'high', threshold: { min: rule.min, max: rule.max } });
    }
    if (triggered.length > 0) {
      this.fastify.io.to(`device:${deviceId}`).emit(SOCKET_EVENTS.ALERT_TRIGGERED, { deviceId, alerts: triggered, timestamp: new Date().toISOString() });
    }
    return triggered;
  }

  async sendPushNotification(pushToken: string, title: string, body: string, data?: Record<string, unknown>): Promise<boolean> {
    if (!Expo.isExpoPushToken(pushToken)) return false;
    const message: ExpoPushMessage = { to: pushToken, sound: 'default', title, body, data, priority: 'high', channelId: 'ecosmart-alerts' };
    try {
      const chunks = expo.chunkPushNotifications([message]);
      for (const chunk of chunks) await expo.sendPushNotificationsAsync(chunk);
      return true;
    } catch (err) { this.fastify.log.error({ err }, 'Push notification failed'); return false; }
  }

  buildAlertMessage(alert: AlertPayload): { title: string; body: string } {
    const rule      = DEFAULT_RULES.find((r) => r.field === alert.field);
    const label     = rule?.label ?? alert.field;
    const unit      = rule?.unit  ?? '';
    const isDanger  = alert.status === 'low' ? alert.value < (rule?.dangerMin ?? alert.threshold.min - 5) : alert.value > (rule?.dangerMax ?? alert.threshold.max + 5);
    const levelText = isDanger ? '🔴 KRITIS' : '🟡 Peringatan';
    const dirText   = alert.status === 'low' ? 'terlalu rendah' : 'terlalu tinggi';
    return { title: `${levelText} — ${label}`, body: `${label} ${dirText}: ${alert.value}${unit} (batas: ${alert.threshold.min}–${alert.threshold.max}${unit})` };
  }
}
