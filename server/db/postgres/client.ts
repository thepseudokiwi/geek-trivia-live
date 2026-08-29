import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

export function createPostgresDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to use the Neon database.');
  }
  return drizzle(neon(connectionString), { schema });
}

export type PostgresDb = ReturnType<typeof createPostgresDb>;
