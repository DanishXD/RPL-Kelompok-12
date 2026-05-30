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
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
  try {
    const c = await pool.connect(); await c.query('SELECT 1'); c.release();
    fastify.log.info('✅ PostgreSQL connected');
  } catch (err) { fastify.log.error({ err }, '❌ PostgreSQL failed'); throw err; }
  fastify.decorate('db', drizzle(pool, { schema }));
  fastify.addHook('onClose', async () => { await pool.end(); });
});
