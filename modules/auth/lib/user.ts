import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { redirect } from 'next/navigation';

import { users } from '@/db/schema';

import { SIGN_IN_PATH } from './constants';
import { createSupabaseServerClient } from './supabase-server';

// The one way server code (pages, server actions, route handlers) learns who the User is.
// getClaims verifies the session's JWT, so a forged cookie can't pose as a User. Any failure,
// including no session at all, means signed out.
export async function getUserId() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) return null;

  return data.claims.sub;
}

// For pages and actions only a User may use: sends a signed-out visitor to sign in.
export async function requireUserId() {
  const userId = await getUserId();

  if (!userId) redirect(SIGN_IN_PATH);

  return userId;
}

type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

// Makes sure the User has a row for other tables to reference. Runs on every sign-in, so it
// must leave an existing row alone; that also refills a local database that was wiped.
export async function recordUser(db: Database, userId: string) {
  await db.insert(users).values({ id: userId }).onConflictDoNothing();
}
