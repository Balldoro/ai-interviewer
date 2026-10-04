// The in-memory Postgres that stands in for `@/db` in tests (see vitest.setup.ts).
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

let testDb: ReturnType<typeof drizzle> | undefined;

export async function createTestDatabase() {
  testDb = drizzle({ client: new PGlite() });
  await migrate(testDb, { migrationsFolder: 'drizzle' });
  return testDb;
}

export async function resetTestDatabase() {
  if (!testDb) return;

  const { rows } = await testDb.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const tables = rows.map(({ tablename }) => sql.identifier(tablename));

  await testDb.execute(sql`truncate ${sql.join(tables, sql`, `)} cascade`);
}
