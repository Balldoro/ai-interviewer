import type { NextRequest } from 'next/server';

import { updateSession } from '@/modules/auth/lib/update-session';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything but static assets, images and the health check.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
