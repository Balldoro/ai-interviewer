import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/env';

// Refreshes the Supabase session and writes the new tokens to both the request (for the page
// rendering now) and the response (for the browser). Server Components can't set cookies, so
// without this an expired access token would sign the User out. It doesn't guard pages;
// that's requireUserId's job.
// Adapted from https://supabase.com/docs/guides/auth/server-side/creating-a-client; keep the
// cookie handling as it is there.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Keeps a CDN from caching a response that carries someone's session cookies.
          for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
        },
      },
    },
  );

  await supabase.auth.getClaims();

  return response;
}
