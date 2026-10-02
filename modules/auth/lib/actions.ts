'use server';

import type { Provider } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { SIGN_IN_PATH } from './constants';
import { createSupabaseServerClient } from './supabase-server';

export type OAuthProvider = Extract<Provider, 'github' | 'google'>;

export async function signInWith(provider: OAuthProvider) {
  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get('origin');

  const callbackUrl = new URL('/auth/callback', origin ?? undefined);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error) {
    console.error(`Sign-in with ${provider} failed to start`, error);
    redirect(`${SIGN_IN_PATH}?error=sign-in-failed`);
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  // Local scope ends only this browser's session, not the User's other devices.
  await supabase.auth.signOut({ scope: 'local' });

  redirect(SIGN_IN_PATH);
}
