// `pnpm db:seed`: makes the database DATABASE_URL points at match the committed question files.
import '../load-env';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getDatabaseConfig } from './config';
import { QUESTION_BANK_DIR, type Counts, seedQuestionBank } from './seed-question-bank';

function formatCounts({ created, updated, deleted }: Counts) {
  return `${created} created, ${updated} updated, ${deleted} deleted`;
}

async function main() {
  // A dedicated pool rather than the app's `db`, so it can be closed and the process can exit.
  const { url, ssl } = getDatabaseConfig();
  const pool = new Pool({ connectionString: url.toString(), ssl });
  try {
    const summary = await seedQuestionBank({
      contentDir: QUESTION_BANK_DIR,
      db: drizzle({ client: pool }),
    });
    console.log(
      `Seeded the question bank.\n  Questions: ${formatCounts(summary.questions)}\n  Variants:  ${formatCounts(summary.variants)}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error && error.message ? error.message : error);
  process.exit(1);
});
