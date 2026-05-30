import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../drizzle/schema';

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle<typeof schema>>;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  // Gunakan parameter individual dari environment variable
  const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '6543'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    max: 20,
    ssl: { rejectUnauthorized: false } // setara dengan sslmode=no-verify
  });

  // Debug: tampilkan konfigurasi (tanpa password)
  fastify.log.info({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    database: process.env.PGDATABASE,
    ssl: 'rejectUnauthorized=false'
  }, '🔌 PostgreSQL connecting with config');

  try {
    const c = await pool.connect();
    await c.query('SELECT 1');
    c.release();
    fastify.log.info('✅ PostgreSQL connected');
  } catch (err) {
    fastify.log.error({ err }, '❌ PostgreSQL failed');
    throw err;
  }

  fastify.decorate('db', drizzle(pool, { schema }));
  fastify.addHook('onClose', async () => { await pool.end(); });
});