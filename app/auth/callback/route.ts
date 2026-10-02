import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/db';
import { recordUser } from '@/modules/auth/lib/user';
import { SIGN_IN_PATH } from '@/modules/auth/lib/constants';
import { createSupabaseServerClient } from '@/modules/auth/lib/supabase-server';

// GitHub or Google sends the User back here (via Supabase) with a one-time code.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Exchanging the OAuth code for a session failed', error);
    } else {
      try {
        await recordUser(db, data.user.id);

        return NextResponse.redirect(new URL('/', origin));
      } catch (recordError) {
        console.error('Recording the User failed', recordError);
        // Without this the new session would stay, and the sign-in page would send the User
        // straight on instead of showing the error.
        await supabase.auth.signOut({ scope: 'local' });
      }
    }
  }

  const signInUrl = new URL(SIGN_IN_PATH, origin);
  signInUrl.searchParams.set('error', 'sign-in-failed');

  return NextResponse.redirect(signInUrl);
}
