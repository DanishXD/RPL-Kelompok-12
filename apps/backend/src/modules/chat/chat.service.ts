import Groq from 'groq-sdk';
import { FastifyInstance } from 'fastify';
import { IotService } from '../iot/iot.service';
import type { ChatMessage, ChatSession, SensorContext } from './chat.schema';

const sessions = new Map<string, ChatSession>();

function buildSystemPrompt(sensor?: SensorContext): string {
  const sensorInfo = sensor ? `
Data sensor kolam saat ini:
- Suhu    : ${sensor.temperature !== undefined ? `${sensor.temperature}°C` : 'tidak tersedia'}
- pH      : ${sensor.phLevel     !== undefined ? sensor.phLevel            : 'tidak tersedia'}
- Pakan   : ${sensor.feedLevel   !== undefined ? `${sensor.feedLevel}%`    : 'tidak tersedia'}
- Cahaya  : ${sensor.lightLevel  !== undefined ? `${sensor.lightLevel} lx` : 'tidak tersedia'}

Analisis:
${sensor.temperature !== undefined ? (sensor.temperature > 32 ? '⚠️ SUHU TINGGI' : sensor.temperature < 24 ? '⚠️ SUHU RENDAH' : '✅ Suhu normal') : ''}
${sensor.phLevel     !== undefined ? ((sensor.phLevel < 6.5 || sensor.phLevel > 8.5) ? '⚠️ pH TIDAK NORMAL' : '✅ pH normal') : ''}
${sensor.feedLevel   !== undefined ? (sensor.feedLevel < 10 ? '🔴 PAKAN KRITIS' : sensor.feedLevel < 20 ? '⚠️ PAKAN RENDAH' : '✅ Pakan aman') : ''}
` : 'Data sensor tidak tersedia.';
  return `Kamu adalah asisten AI ahli budidaya ikan untuk aplikasi EcoSmart Feeder.
Berikan jawaban praktis dalam Bahasa Indonesia, singkat dan langsung ke inti.
Jika ada kondisi berbahaya, sampaikan peringatan di awal.
${sensorInfo}`;
}

export class ChatService {
  private groq: Groq;
  constructor(private fastify: FastifyInstance) {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async sendMessage(userId: string, message: string, deviceId?: string, sessionId?: string) {
    const sid     = sessionId ?? `${userId}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
    const session = sessions.get(sid) ?? this.createSession(sid, deviceId);
    let sensorContext: SensorContext | undefined;
    if (deviceId) {
      try {
        const iot    = new IotService(this.fastify);
        const latest = await iot.getLatestSensorData(deviceId);
        sensorContext = { deviceId: latest.deviceId, temperature: latest.temperature, phLevel: latest.phLevel, feedLevel: latest.feedLevel, lightLevel: latest.lightLevel, timestamp: latest.timestamp };
      } catch { this.fastify.log.warn({ deviceId }, 'Sensor data not available for chat'); }
    }
    session.messages.push({ role: 'user', content: message });
    const recentMessages = session.messages.slice(-10);
    const groqMessages = [
      { role: 'system' as const, content: buildSystemPrompt(sensorContext) },
      ...recentMessages.map((m) => ({ role: m.role as 'user'|'assistant', content: m.content })),
    ];
    let reply = '';
    try {
      const completion = await this.groq.chat.completions.create({
        model: process.env.GROQ_MODEL ?? 'llama3-8b-8192',
        messages: groqMessages,
        max_tokens: 1024,
        temperature: 0.4,
        stream: false,
      });
      reply = completion.choices[0]?.message?.content ?? 'Maaf, tidak bisa memproses permintaan ini.';
    } catch (err: any) {
      this.fastify.log.error({ err }, 'Groq API error');
      if (err?.status === 401) reply = 'Konfigurasi AI bermasalah. Periksa GROQ_API_KEY di .env';
      else if (err?.status === 429) reply = 'Terlalu banyak permintaan. Tunggu sebentar dan coba lagi.';
      else reply = 'Layanan AI sedang tidak tersedia. Coba lagi dalam beberapa menit.';
    }
    session.messages.push({ role: 'assistant', content: reply });
    session.updatedAt = new Date().toISOString();
    sessions.set(sid, session);
    return { reply, sessionId: sid, sensorContext };
  }

  getHistory(userId: string, sessionId: string): ChatMessage[] {
    return (sessions.get(sessionId)?.messages ?? []).filter((m) => m.role !== 'system');
  }

  clearSession(sessionId: string): void { sessions.delete(sessionId); }

  getUserSessions(userId: string) {
    const result = [];
    for (const [sid, session] of sessions.entries()) {
      if (sid.startsWith(userId)) result.push({ sessionId: sid, updatedAt: session.updatedAt, messageCount: session.messages.filter((m) => m.role !== 'system').length });
    }
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private createSession(sessionId: string, deviceId?: string): ChatSession {
    const session: ChatSession = { sessionId, messages: [], deviceId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    sessions.set(sessionId, session);
    return session;
  }
}
