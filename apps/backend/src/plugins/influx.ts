import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { InfluxDB, WriteApi, QueryApi, Point } from '@influxdata/influxdb-client';

// Perbaiki tipe: izinkan writeApi dan queryApi bernilai null
declare module 'fastify' {
  interface FastifyInstance {
    influx: {
      writeApi: WriteApi | null;
      queryApi: QueryApi | null;
      writePoint: (p: Point) => void;
      flush: () => Promise<void>;
    };
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const url    = process.env.INFLUXDB_URL    ?? 'http://localhost:8086';
  const token  = process.env.INFLUXDB_TOKEN  ?? 'ecosmart-dev-token-12345';
  const org    = process.env.INFLUXDB_ORG    ?? 'ecosmart';
  const bucket = process.env.INFLUXDB_BUCKET ?? 'sensors';

  fastify.log.info({ url, org, bucket }, 'InfluxDB configuration');

  const client   = new InfluxDB({ url, token });
  const writeApi = client.getWriteApi(org, bucket, 'ns');
  const queryApi = client.getQueryApi(org);
  writeApi.useDefaultTags({ service: 'ecosmart-feeder' });

  // Coba koneksi dengan query sederhana
  try {
    const testQuery = `from(bucket: "${bucket}") |> range(start: -1h) |> limit(n: 1)`;
    await queryApi.collectRows(testQuery);
    fastify.log.info('✅ InfluxDB connected');
  } catch (err) {
    fastify.log.warn({ err }, '⚠️ InfluxDB connection failed, continuing without InfluxDB');
    // Ini sekarang tidak merah karena tipe sudah memperbolehkan null
    fastify.decorate('influx', {
      writeApi: null,
      queryApi: null,
      writePoint: () => {},
      flush: async () => {},
    });
    return;
  }

  fastify.decorate('influx', {
    writeApi,
    queryApi,
    writePoint: (p: Point) => writeApi.writePoint(p),
    flush: async () => { await writeApi.flush(); },
  });

  fastify.addHook('onClose', async () => {
    try { await writeApi.close(); } catch {}
  });
});