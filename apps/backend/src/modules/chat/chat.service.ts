import Groq from 'groq-sdk';
import { FastifyInstance } from 'fastify';
import { IotService } from '../iot/iot.service';
import type { ChatMessage, ChatSession, SensorContext } from './chat.schema';

const sessions = new Map<string, ChatSession>();

// ── Kata kunci yang memicu pemanggilan model ML ───────────────────────────────
const ML_KEYWORDS = [
  'kapan', 'waktu', 'jam', 'pakan', 'rekomendasi', 'rekomendasikan',
  'berapa', 'banyak', 'gram', 'kasih', 'beri', 'pemberian',
  'saran', 'sarankan', 'anjuran', 'optimal', 'terbaik', 'sebaiknya',
];

function needsMLPrediction(message: string): boolean {
  const lower = message.toLowerCase();
  return ML_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Panggil ML API untuk prediksi pakan ──────────────────────────────────────
interface MLPrediction {
  timeSlot:   { label: string; timeRange: string | null; confidence: number };
  amountGram: { gram: number; confidence: number };
  recommendation: string;
}

async function getMLPrediction(sensor: SensorContext): Promise<MLPrediction | null> {
  const mlUrl = process.env.ML_API_URL ?? 'http://localhost:5001';

  try {
    const response = await fetch(`${mlUrl}/predict`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        temperature: sensor.temperature ?? 28,
        ph_level:    sensor.phLevel     ?? 7.0,
        feed_level:  sensor.feedLevel   ?? 50,
        light_level: sensor.lightLevel  ?? 300,
        hour:        new Date().getHours(),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = await response.json() as any;
    if (!data.success) return null;

    return {
      timeSlot: {
        label:      data.data.prediction.time_slot.label,
        timeRange:  data.data.prediction.time_slot.time_range,
        confidence: data.data.prediction.time_slot.confidence,
      },
      amountGram: {
        gram:       data.data.prediction.amount_gram.gram,
        confidence: data.data.prediction.amount_gram.confidence,
      },
      recommendation: data.data.recommendation,
    };
  } catch {
    return null;  // ML API tidak tersedia — fallback ke LLaMA saja
  }
}

// ── System prompt dengan sensor context + hasil ML ───────────────────────────
function buildSystemPrompt(sensor?: SensorContext, ml?: MLPrediction | null): string {

  const sensorInfo = sensor ? `
Data sensor kolam saat ini:
- Suhu    : ${sensor.temperature !== undefined ? `${sensor.temperature}°C` : 'tidak tersedia'}
- pH      : ${sensor.phLevel     !== undefined ? `${sensor.phLevel}`       : 'tidak tersedia'}
- Pakan   : ${sensor.feedLevel   !== undefined ? `${sensor.feedLevel}%`    : 'tidak tersedia'}
- Cahaya  : ${sensor.lightLevel  !== undefined ? `${sensor.lightLevel} lx` : 'tidak tersedia'}

Analisis kondisi:
${sensor.temperature !== undefined ? (sensor.temperature > 32 ? '⚠️ SUHU TINGGI' : sensor.temperature < 24 ? '⚠️ SUHU RENDAH' : '✅ Suhu normal') : ''}
${sensor.phLevel     !== undefined ? ((sensor.phLevel < 6.5 || sensor.phLevel > 8.5) ? '⚠️ pH TIDAK NORMAL' : '✅ pH normal') : ''}
${sensor.feedLevel   !== undefined ? (sensor.feedLevel < 10 ? '🔴 PAKAN KRITIS' : sensor.feedLevel < 20 ? '⚠️ PAKAN RENDAH' : '✅ Pakan aman') : ''}
` : 'Data sensor tidak tersedia.';

  const mlInfo = ml ? `
Hasil prediksi model Machine Learning (Gradient Boosting):
- Waktu terbaik memberi pakan : ${ml.timeSlot.label}${ml.timeSlot.timeRange ? ` (${ml.timeSlot.timeRange})` : ''} — keyakinan model: ${ml.timeSlot.confidence}%
- Jumlah pakan yang disarankan: ${ml.amountGram.gram}g — keyakinan model: ${ml.amountGram.confidence}%

PENTING: Gunakan hasil prediksi ML di atas sebagai dasar utama menjawab pertanyaan tentang
kapan dan berapa banyak pakan. Sebutkan bahwa rekomendasi ini dihasilkan oleh model ML
yang dilatih dengan data kondisi budidaya ikan lele.
` : '';

  return `Kamu adalah asisten AI ahli budidaya ikan untuk aplikasi EcoSmart Feeder.
Berikan jawaban praktis dalam Bahasa Indonesia, singkat dan langsung ke inti.
Jika ada kondisi berbahaya, sampaikan peringatan di awal.
${sensorInfo}${mlInfo}`;
}

// ── ChatService ───────────────────────────────────────────────────────────────

export class ChatService {
  private groq: Groq;

  constructor(private fastify: FastifyInstance) {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async sendMessage(userId: string, message: string, deviceId?: string, sessionId?: string) {
    const sid     = sessionId ?? `${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const session = sessions.get(sid) ?? this.createSession(sid, deviceId);

    // ── Ambil data sensor terbaru ─────────────────────────────────────────────
    let sensorContext: SensorContext | undefined;
    if (deviceId) {
      try {
        const iot    = new IotService(this.fastify);
        const latest = await iot.getLatestSensorData(deviceId);
        sensorContext = {
          deviceId:    latest.deviceId,
          temperature: latest.temperature,
          phLevel:     latest.phLevel,
          feedLevel:   latest.feedLevel,
          lightLevel:  latest.lightLevel,
          timestamp:   latest.timestamp,
        };
      } catch {
        this.fastify.log.warn({ deviceId }, 'Sensor data not available for chat');
      }
    }

    // ── Panggil ML API jika pesan terkait rekomendasi pakan ──────────────────
    let mlPrediction: MLPrediction | null = null;
    if (sensorContext && needsMLPrediction(message)) {
      mlPrediction = await getMLPrediction(sensorContext);
      if (mlPrediction) {
        this.fastify.log.info(
          { timeSlot: mlPrediction.timeSlot.label, gram: mlPrediction.amountGram.gram },
          '🤖 ML prediction injected into chat context'
        );
      }
    }

    // ── Siapkan pesan untuk Groq ──────────────────────────────────────────────
    session.messages.push({ role: 'user', content: message });
    const recentMessages = session.messages.slice(-10);

    const groqMessages = [
      { role: 'system' as const, content: buildSystemPrompt(sensorContext, mlPrediction) },
      ...recentMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // ── Kirim ke Groq ─────────────────────────────────────────────────────────
    let reply = '';
    try {
      const completion = await this.groq.chat.completions.create({
        model:       process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        messages:    groqMessages,
        max_tokens:  1024,
        temperature: 0.4,
        stream:      false,
      });
      reply = completion.choices[0]?.message?.content ?? 'Maaf, tidak bisa memproses permintaan ini.';
    } catch (err: any) {
      this.fastify.log.error({ err }, 'Groq API error');
      if (err?.status === 401)      reply = 'Konfigurasi AI bermasalah. Periksa GROQ_API_KEY di .env';
      else if (err?.status === 429) reply = 'Terlalu banyak permintaan. Tunggu sebentar dan coba lagi.';
      else                          reply = 'Layanan AI sedang tidak tersedia. Coba lagi dalam beberapa menit.';
    }

    session.messages.push({ role: 'assistant', content: reply });
    session.updatedAt = new Date().toISOString();
    sessions.set(sid, session);

    return { reply, sessionId: sid, sensorContext };
  }

  getHistory(_userId: string, sessionId: string): ChatMessage[] {
    return (sessions.get(sessionId)?.messages ?? []).filter(m => m.role !== 'system');
  }

  clearSession(sessionId: string): void {
    sessions.delete(sessionId);
  }

  getUserSessions(userId: string) {
    const result = [];
    for (const [sid, session] of sessions.entries()) {
      if (sid.startsWith(userId)) {
        result.push({
          sessionId:    sid,
          updatedAt:    session.updatedAt,
          messageCount: session.messages.filter(m => m.role !== 'system').length,
        });
      }
    }
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private createSession(sessionId: string, deviceId?: string): ChatSession {
    const session: ChatSession = {
      sessionId,
      messages:  [],
      deviceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessions.set(sessionId, session);
    return session;
  }
}
