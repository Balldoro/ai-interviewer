import 'server-only';

import { redirect } from 'next/navigation';

import { db } from '@/db';
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

// Makes sure the User has a row for other tables to reference. Runs on every sign-in, so it
// must leave an existing row alone; that also refills a local database that was wiped.
export async function recordUser(userId: string) {
  await db.insert(users).values({ id: userId }).onConflictDoNothing();
}
