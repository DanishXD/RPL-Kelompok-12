import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import {
  InfluxDB,
  WriteApi,
  QueryApi,
  Point,
} from '@influxdata/influxdb-client';

// ── Extend FastifyInstance ────────────────────────────────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    influx: {
      writeApi: WriteApi;
      queryApi: QueryApi;
      writePoint: (point: Point) => void;
      flush: () => Promise<void>;
    };
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const url    = process.env.INFLUXDB_URL    ?? 'http://localhost:8086';
  const token  = process.env.INFLUXDB_TOKEN  ?? 'ecosmart-dev-token-12345';
  const org    = process.env.INFLUXDB_ORG    ?? 'ecosmart';
  const bucket = process.env.INFLUXDB_BUCKET ?? 'sensors';

  const client   = new InfluxDB({ url, token });
  const writeApi = client.getWriteApi(org, bucket, 'ns');
  const queryApi = client.getQueryApi(org);

  // Default tags yang otomatis ditambahkan ke setiap data point
  writeApi.useDefaultTags({ service: 'ecosmart-feeder' });

  // Test koneksi
  try {
    await queryApi.collectRows('buckets()');
    fastify.log.info('✅ InfluxDB connected');
  } catch (err) {
    fastify.log.error({ err }, '❌ InfluxDB connection failed');
    throw err;
  }

  fastify.decorate('influx', {
    writeApi,
    queryApi,

    // Tulis satu data point ke InfluxDB
    writePoint: (point: Point) => {
      writeApi.writePoint(point);
    },

    // Paksa flush semua data yang masih di buffer ke InfluxDB
    flush: async () => {
      await writeApi.flush();
    },
  });

  // Flush dan tutup koneksi saat server shutdown
  fastify.addHook('onClose', async () => {
    try {
      await writeApi.close();
      fastify.log.info('InfluxDB write API closed');
    } catch (err) {
      fastify.log.error({ err }, 'Error closing InfluxDB');
    }
  });
});
