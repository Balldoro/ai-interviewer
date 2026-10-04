import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { ROUTES } from '@/lib/routes';
import { recordUser } from '@/modules/auth/lib/user';
import { createSupabaseServerClient } from '@/modules/auth/lib/supabase-client';

// GitHub or Google sends the User back here (via Supabase) with a one-time code.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error('Exchanging the OAuth code for a session failed', error);
    } else {
      try {
        await recordUser(data.user.id);

        return NextResponse.redirect(new URL(ROUTES.setup, origin));
      } catch (recordError) {
        logger.error('Recording the User failed', recordError);
        // Without this the new session would stay, and the sign-in page would send the User
        // straight on instead of showing the error.
        await supabase.auth.signOut({ scope: 'local' });
      }
    }
  }

  const signInUrl = new URL(ROUTES.signIn, origin);
  signInUrl.searchParams.set('error', 'sign-in-failed');

  return NextResponse.redirect(signInUrl);
}
