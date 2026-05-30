import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// ── URL ML API (Python Flask) ─────────────────────────────────────────────────
const ML_API_URL = process.env.ML_API_URL ?? 'http://localhost:5001';

const predictSchema = z.object({
  temperature: z.number().min(0).max(50),
  ph_level:    z.number().min(0).max(14),
  feed_level:  z.number().min(0).max(100),
  light_level: z.number().min(0),
  hour:        z.number().int().min(0).max(23).optional(), // default: jam sekarang
});

export async function recommendationRoutes(fastify: FastifyInstance) {

  // ── POST /api/recommendation/predict ─────────────────────────────────────
  // Prediksi waktu & jumlah pakan berdasarkan kondisi sensor saat ini
  // Butuh login user (JWT)

  fastify.post(
    '/predict',
    { preHandler: [fastify.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const result = predictSchema.safeParse(req.body);
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error:   'Validasi gagal',
          details: result.error.errors,
        });
      }

      const { temperature, ph_level, feed_level, light_level } = result.data;
      const hour = result.data.hour ?? new Date().getHours();

      try {
        const response = await fetch(`${ML_API_URL}/predict`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ temperature, ph_level, feed_level, light_level, hour }),
          signal:  AbortSignal.timeout(5000), // timeout 5 detik
        });

        if (!response.ok) {
          const err = await response.json() as { error?: string };
          return reply.status(502).send({
            success: false,
            error:   `ML API error: ${err.error ?? response.statusText}`,
          });
        }

        const mlResult = await response.json();
        return reply.status(200).send(mlResult);

      } catch (err: any) {
        fastify.log.error({ err }, 'Failed to reach ML API');

        // Fallback: rule-based sederhana kalau ML API tidak jalan
        const fallback = getFallbackRecommendation(temperature, ph_level, feed_level, hour);
        return reply.status(200).send({
          success:  true,
          fallback: true,
          message:  'ML API tidak tersedia, menggunakan rule-based fallback',
          data:     fallback,
        });
      }
    }
  );

  // ── GET /api/recommendation/model-info ───────────────────────────────────
  // Info akurasi model — berguna untuk tampil di UI

  fastify.get(
    '/model-info',
    { preHandler: [fastify.authenticate] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${ML_API_URL}/model-info`, {
          signal: AbortSignal.timeout(3000),
        });
        const data = await response.json();
        return reply.status(200).send(data);
      } catch {
        return reply.status(503).send({
          success: false,
          error:   'ML API tidak tersedia',
        });
      }
    }
  );
}

// ── Fallback rule-based (kalau ML API mati) ───────────────────────────────────

function getFallbackRecommendation(
  temperature: number,
  ph_level:    number,
  feed_level:  number,
  hour:        number
) {
  const tempOk = temperature >= 26 && temperature <= 30;
  const phOk   = ph_level >= 6.5 && ph_level <= 8.0;
  const feedOk = feed_level > 20;

  let timeSlot = { label: 'Tidak Direkomendasikan', time_range: null as string | null };
  if (tempOk && phOk && feedOk) {
    if (hour >= 6  && hour <= 8)  timeSlot = { label: 'Pagi',  time_range: '06:00–08:00' };
    if (hour >= 12 && hour <= 13) timeSlot = { label: 'Siang', time_range: '12:00–13:00' };
    if (hour >= 17 && hour <= 18) timeSlot = { label: 'Sore',  time_range: '17:00–18:00' };
  }

  const score = (tempOk ? 1 : 0) + (phOk ? 1 : 0) + (feedOk ? 1 : 0);
  const gram  = score >= 3 ? 150 : score >= 2 ? 100 : 50;

  return {
    prediction: {
      time_slot:   { label: timeSlot.label, time_range: timeSlot.time_range, confidence: null },
      amount_gram: { gram, confidence: null },
    },
    recommendation:
      timeSlot.label === 'Tidak Direkomendasikan'
        ? `Kondisi kolam kurang ideal. Suhu ${temperature}°C, pH ${ph_level}.`
        : `Waktu terbaik: ${timeSlot.label} (${timeSlot.time_range}). Jumlah: ${gram}g.`,
  };
}
