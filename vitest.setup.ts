import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { createTestDatabase, resetTestDatabase } from './db/test-database';

// `server-only` throws outside a React Server Components build, which tests aren't.
vi.mock('server-only', () => ({}));

// Every test that touches `@/db` gets an in-memory Postgres with the real migrations applied.
vi.mock('@/db', async () => ({ db: await createTestDatabase() }));

beforeEach(async () => {
  await resetTestDatabase();
});

afterEach(() => {
  cleanup();
});
