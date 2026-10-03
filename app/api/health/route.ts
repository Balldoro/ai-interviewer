import { sql } from 'drizzle-orm';

import { db } from '@/db';
import { logger } from '@/lib/logger';

export async function GET() {
  const startedAt = performance.now();

  try {
    await db.execute(sql`select 1`);

    return Response.json({
      status: 'ok',
      database: 'ok',
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    logger.error('Health check failed', error);

    return Response.json({ status: 'error', database: 'unreachable' }, { status: 503 });
  }
}
