// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { users } from '@/db/schema';

import { getUserId, recordUser, requireUserId } from './user';

const { getClaims, redirect } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  // Like Next.js's redirect, it never returns.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock('./supabase-client', () => ({
  createSupabaseServerClient: async () => ({ auth: { getClaims } }),
}));

vi.mock('next/navigation', () => ({ redirect }));

function signedInAs(userId: string) {
  getClaims.mockResolvedValue({ data: { claims: { sub: userId } }, error: null });
}

function signedOut() {
  getClaims.mockResolvedValue({ data: null, error: null });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('getUserId', () => {
  it("returns the signed-in User's id", async () => {
    signedInAs('user-1');

    await expect(getUserId()).resolves.toBe('user-1');
  });

  it('returns null without a session', async () => {
    signedOut();

    await expect(getUserId()).resolves.toBeNull();
  });

  it('treats a session that fails verification as signed out', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('invalid JWT') });

    await expect(getUserId()).resolves.toBeNull();
  });
});

describe('requireUserId', () => {
  it('lets a signed-in User through', async () => {
    signedInAs('user-1');

    await expect(requireUserId()).resolves.toBe('user-1');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor to sign in', async () => {
    signedOut();

    await expect(requireUserId()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/sign-in');
  });

  it('sends a visitor whose session fails verification to sign in', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('session expired') });

    await expect(requireUserId()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/sign-in');
  });
});

describe('recordUser', () => {
  const USER_ID = '6f1c2b0e-8a4d-4f3a-9a57-2d0c1e5b7f90';

  it('creates a row for a User signing in for the first time', async () => {
    await recordUser(USER_ID);

    await expect(db.select({ id: users.id }).from(users)).resolves.toEqual([{ id: USER_ID }]);
  });

  it('leaves the existing row alone when the User signs in again', async () => {
    await recordUser(USER_ID);
    const [first] = await db.select().from(users);

    await recordUser(USER_ID);

    await expect(db.select().from(users)).resolves.toEqual([first]);
  });
});
