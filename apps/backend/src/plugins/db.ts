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
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    fastify.log.info('✅ PostgreSQL connected');
  } catch (error) {
    fastify.log.error({ err: error }, '❌ PostgreSQL connection failed');
    throw error;
  }

  const db = drizzle(pool, { schema });
  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
});
