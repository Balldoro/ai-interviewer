import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getDatabaseConfig } from './config';
import * as schema from './schema';

function createPool() {
  // Plain TCP via node-postgres works against both local Postgres and Supabase,
  // so switching environments only means changing env vars.
  const { url, ssl } = getDatabaseConfig();
  const pool = new Pool({ connectionString: url.toString(), ssl });
  // Releases idle connections before a Vercel Fluid compute instance is suspended. No-op elsewhere.
  attachDatabasePool(pool);
  return pool;
}

// Cached on globalThis so dev hot reloads reuse one pool instead of leaking connections.
// The pool connects lazily, on the first query.
const globalForDb = globalThis as unknown as { pool?: Pool };
globalForDb.pool ??= createPool();

export const db = drizzle({ client: globalForDb.pool, schema });
