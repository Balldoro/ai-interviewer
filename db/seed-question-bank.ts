import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import matter from 'gray-matter';
import * as z from 'zod';

import { QUESTION_CATEGORIES, SENIORITY_LEVELS } from '../modules/setup/lib/constants';
import { questions, questionVariants } from './schema';

// The question files committed to the repo: one markdown file per Question, in a folder per Category.
export const QUESTION_BANK_DIR = path.resolve('content/questions');

const variantSchema = z.object({
  // Absent means level-agnostic.
  seniorityLevel: z.enum(SENIORITY_LEVELS).optional(),
  // Absent means the Question's default Question Text applies.
  textOverride: z.string().trim().min(1).optional(),
  keyPoints: z.array(z.string().trim().min(1)).min(1),
});

const questionFileSchema = z.object({
  id: z.string().trim().min(1),
  category: z.enum(QUESTION_CATEGORIES),
  text: z.string().trim().min(1),
  variants: z
    .array(variantSchema)
    .min(1)
    .superRefine((variants, ctx) => {
      const levels = variants.map((variant) => variant.seniorityLevel);
      if (levels.includes(undefined) && variants.length > 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'A level-agnostic Variant must be the only Variant of its Question',
        });
      }
      const duplicates = new Set(levels.filter((level, i) => level && levels.indexOf(level) !== i));
      for (const level of duplicates) {
        ctx.addIssue({
          code: 'custom',
          message: `More than one Variant for Seniority Level "${level}"`,
        });
      }
    }),
});

type Question = z.infer<typeof questionFileSchema> & { explanation: string };

// Accepts any Drizzle Postgres database: node-postgres in the app, PGlite in tests.
type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

/**
 * Makes the database hold the Questions described by the question files under `contentDir`.
 * Every file is validated before anything is written; on any problem it throws one error listing
 * them all, each tagged with its file, and writes nothing.
 */
export async function seedQuestionBank({ contentDir, db }: { contentDir: string; db: Database }) {
  const bank = await readQuestionBank(contentDir);

  await db.transaction(async (tx) => {
    for (const { variants, ...question } of bank) {
      const { id, ...fields } = question;
      await tx
        .insert(questions)
        .values(question)
        .onConflictDoUpdate({ target: questions.id, set: fields });
      // Rewriting a Question's Variants keeps them identical to its file.
      await tx.delete(questionVariants).where(eq(questionVariants.questionId, id));
      await tx.insert(questionVariants).values(
        variants.map((variant) => ({
          questionId: id,
          seniorityLevel: variant.seniorityLevel ?? null,
          textOverride: variant.textOverride ?? null,
          keyPoints: variant.keyPoints,
        })),
      );
    }
  });
}

async function readQuestionBank(contentDir: string): Promise<Question[]> {
  const entries = await readdir(contentDir, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .toSorted();

  const bank: Question[] = [];
  const problems: string[] = [];
  for (const file of files) {
    const label = path.relative(contentDir, file);
    const { data, content } = matter(await readFile(file, 'utf8'));
    const explanation = content.trim();
    const result = questionFileSchema.safeParse(data);

    if (!explanation) {
      problems.push(`${label}: the Explanation (markdown body) is empty`);
    }
    if (!result.success) {
      for (const issue of result.error.issues) {
        const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        problems.push(`${label}: ${where}${issue.message}`);
      }
    }
    if (result.success && explanation) {
      bank.push({ ...result.data, explanation });
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid question files:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`,
    );
  }
  return bank;
}
