'use server';

import type { Provider } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';

import { createSupabaseServerClient } from './supabase-client';

export type OAuthProvider = Extract<Provider, 'github' | 'google'>;

export async function signInWith(provider: OAuthProvider) {
  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get('origin');

  const callbackUrl = new URL(ROUTES.authCallback, origin ?? undefined);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error) {
    console.error(`Sign-in with ${provider} failed to start`, error);
    redirect(`${ROUTES.signIn}?error=sign-in-failed`);
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect(ROUTES.signIn);
}
