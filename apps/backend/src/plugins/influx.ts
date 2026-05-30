import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { InfluxDB, WriteApi, QueryApi, Point } from '@influxdata/influxdb-client';

declare module 'fastify' {
  interface FastifyInstance {
    influx: { writeApi: WriteApi; queryApi: QueryApi; writePoint: (p: Point) => void; flush: () => Promise<void>; };
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
  writeApi.useDefaultTags({ service: 'ecosmart-feeder' });
  try { await queryApi.collectRows('buckets()'); fastify.log.info('✅ InfluxDB connected'); }
  catch (err) { fastify.log.error({ err }, '❌ InfluxDB failed'); throw err; }
  fastify.decorate('influx', {
    writeApi, queryApi,
    writePoint: (p: Point) => writeApi.writePoint(p),
    flush: async () => { await writeApi.flush(); },
  });
  fastify.addHook('onClose', async () => { try { await writeApi.close(); } catch {} });
});
