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
  // Debug: cek apakah DATABASE_URL terbaca
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    fastify.log.error('❌ DATABASE_URL environment variable is NOT set!');
    throw new Error('DATABASE_URL missing');
  }
  // Hanya untuk debug: tampilkan awal URL (sembunyikan password)
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':*****@');
  fastify.log.info(`DATABASE_URL is set: ${maskedUrl}`);
  
  const pool = new Pool({ connectionString: dbUrl, max: 20 });
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