import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { devices, users } from '../../../drizzle/schema';
import { SOCKET_EVENTS } from '../../plugins/socket';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AlertPayload {
  deviceId:  string;
  field:     string;
  value:     number;
  status:    'low' | 'high';
  threshold: { min: number; max: number };
}

export interface AlertRule {
  field:     string;
  label:     string;
  unit:      string;
  min:       number;
  max:       number;
  dangerMin: number;
  dangerMax: number;
}

// ── Default threshold rules ────────────────────────────────────────────────────

export const DEFAULT_RULES: AlertRule[] = [
  {
    field:     'temperature',
    label:     'Suhu Air',
    unit:      '°C',
    min:       24,
    max:       32,
    dangerMin: 20,
    dangerMax: 36,
  },
  {
    field:     'phLevel',
    label:     'pH Air',
    unit:      '',
    min:       6.5,
    max:       8.5,
    dangerMin: 5.5,
    dangerMax: 9.5,
  },
  {
    field:     'feedLevel',
    label:     'Level Pakan',
    unit:      '%',
    min:       20,
    max:       100,
    dangerMin: 10,
    dangerMax: 100,
  },
];

// ── Expo Push client (gratis, tanpa Firebase) ─────────────────────────────────

const expo = new Expo({ useFcmV1: false });

// ── Alert Engine Service ───────────────────────────────────────────────────────

export class AlertEngine {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // ── Cek data sensor terhadap semua rules ─────────────────────────────────
  checkAndFire(deviceId: string, sensorData: Record<string, number | undefined>) {
    const triggered: AlertPayload[] = [];

    for (const rule of DEFAULT_RULES) {
      const value = sensorData[rule.field];
      if (value === undefined) continue;

      if (value < rule.min) {
        triggered.push({
          deviceId,
          field:     rule.field,
          value,
          status:    'low',
          threshold: { min: rule.min, max: rule.max },
        });
      } else if (value > rule.max) {
        triggered.push({
          deviceId,
          field:     rule.field,
          value,
          status:    'high',
          threshold: { min: rule.min, max: rule.max },
        });
      }
    }

    if (triggered.length > 0) {
      // Broadcast alert via WebSocket ke mobile
      this.fastify.io
        .to(`device:${deviceId}`)
        .emit(SOCKET_EVENTS.ALERT_TRIGGERED, {
          deviceId,
          alerts:    triggered,
          timestamp: new Date().toISOString(),
        });

      this.fastify.log.warn({ triggered, deviceId }, '⚠️ Alert triggered');
    }

    return triggered;
  }

  // ── Kirim push notification via Expo ──────────────────────────────────────
  async sendPushNotification(
    pushToken: string,
    title:   string,
    body:    string,
    data?:   object
  ): Promise<boolean> {
    if (!Expo.isExpoPushToken(pushToken)) {
      this.fastify.log.warn(`Invalid Expo push token: ${pushToken}`);
      return false;
    }

    const message: ExpoPushMessage = {
      to:    pushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'ecosmart-alerts',
    };

    try {
      const chunks  = expo.chunkPushNotifications([message]);
      const tickets = [];

      for (const chunk of chunks) {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }

      this.fastify.log.info({ tickets }, 'Push notification sent');
      return true;
    } catch (err) {
      this.fastify.log.error({ err }, 'Failed to send push notification');
      return false;
    }
  }

  // ── Buat pesan alert yang informatif ──────────────────────────────────────
  buildAlertMessage(alert: AlertPayload): { title: string; body: string } {
    const rule = DEFAULT_RULES.find((r) => r.field === alert.field);
    const label = rule?.label ?? alert.field;
    const unit  = rule?.unit  ?? '';

    const isDanger =
      alert.status === 'low'
        ? alert.value < (rule?.dangerMin ?? alert.threshold.min - 5)
        : alert.value > (rule?.dangerMax ?? alert.threshold.max + 5);

    const levelText = isDanger ? '🔴 KRITIS' : '🟡 Peringatan';
    const dirText   = alert.status === 'low' ? 'terlalu rendah' : 'terlalu tinggi';

    return {
      title: `${levelText} — ${label}`,
      body:  `${label} ${dirText}: ${alert.value}${unit} (batas: ${alert.threshold.min}–${alert.threshold.max}${unit})`,
    };
  }
}
