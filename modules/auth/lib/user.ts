import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { redirect } from 'next/navigation';

import { users } from '@/db/schema';
import { ROUTES } from '@/lib/routes';

import { createSupabaseServerClient } from './supabase-client';

export async function getUserId() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) return null;

  return data.claims.sub;
}

export async function requireUserId() {
  const userId = await getUserId();

  if (!userId) redirect(ROUTES.signIn);

  return userId;
}

type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

// Makes sure the User has a row for other tables to reference. Runs on every sign-in, so it
// must leave an existing row alone; that also refills a local database that was wiped.
export async function recordUser(db: Database, userId: string) {
  await db.insert(users).values({ id: userId }).onConflictDoNothing();
}
