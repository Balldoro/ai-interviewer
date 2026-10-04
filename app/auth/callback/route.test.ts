// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const { exchangeCodeForSession, signOut, recordUser } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  recordUser: vi.fn(),
}));

vi.mock('@/modules/auth/lib/supabase-client', () => ({
  createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession, signOut } }),
}));

vi.mock('@/modules/auth/lib/user', () => ({ recordUser }));

function callback(query: string) {
  return GET(new NextRequest(`http://localhost:3000/auth/callback?${query}`));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /auth/callback', () => {
  it('records the User and sends them to the setup page', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const response = await callback('code=abc');

    expect(recordUser).toHaveBeenCalledExactlyOnceWith('user-1');
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });

  it("doesn't record anyone when the sign-in fails", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: new Error('invalid code'),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await callback('code=abc');

    expect(recordUser).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/sign-in?error=sign-in-failed',
    );
  });

  it('signs the User out and sends them to sign in when recording them fails', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    recordUser.mockRejectedValue(new Error('database unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await callback('code=abc');

    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/sign-in?error=sign-in-failed',
    );
  });
});
