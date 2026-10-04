import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { and, eq, inArray, isNull } from 'drizzle-orm';
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

// Accepts any Drizzle Postgres database: node-postgres in the seed script, PGlite in tests.
type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

export type Counts = { created: number; updated: number; deleted: number };

/** What a seed changed. A Question counts as updated only when its own fields change. */
export type SeedSummary = { questions: Counts; variants: Counts };

/**
 * Makes the database match the question files under `contentDir` exactly: Questions and Variants
 * are created, updated or deleted as the files say, and anything already matching is left alone.
 * Every file is validated before anything is written; on any problem it throws one error listing
 * them all, each tagged with its file, and writes nothing.
 */
export async function seedQuestionBank({
  contentDir,
  db,
}: {
  contentDir: string;
  db: Database;
}): Promise<SeedSummary> {
  const bank = await readQuestionBank(contentDir);
  const summary: SeedSummary = {
    questions: { created: 0, updated: 0, deleted: 0 },
    variants: { created: 0, updated: 0, deleted: 0 },
  };

  await db.transaction(async (tx) => {
    const storedQuestions = new Map(
      (await tx.select().from(questions)).map((question) => [question.id, question]),
    );
    const storedVariants = new Map(
      (await tx.select().from(questionVariants)).map((variant) => [
        variantKey(variant.questionId, variant.seniorityLevel),
        variant,
      ]),
    );

    for (const { variants, ...question } of bank) {
      const { id, ...fields } = question;
      const stored = storedQuestions.get(id);
      if (!stored) {
        await tx.insert(questions).values(question);
        summary.questions.created++;
      } else if (
        stored.category !== fields.category ||
        stored.text !== fields.text ||
        stored.explanation !== fields.explanation
      ) {
        await tx.update(questions).set(fields).where(eq(questions.id, id));
        summary.questions.updated++;
      }

      for (const variant of variants) {
        const seniorityLevel = variant.seniorityLevel ?? null;
        const values = {
          textOverride: variant.textOverride ?? null,
          keyPoints: variant.keyPoints,
        };
        const key = variantKey(id, seniorityLevel);
        const storedVariant = storedVariants.get(key);
        storedVariants.delete(key);
        if (!storedVariant) {
          await tx.insert(questionVariants).values({ questionId: id, seniorityLevel, ...values });
          summary.variants.created++;
        } else if (
          storedVariant.textOverride !== values.textOverride ||
          !isEqualArray(storedVariant.keyPoints, values.keyPoints)
        ) {
          await tx.update(questionVariants).set(values).where(matchesVariant(id, seniorityLevel));
          summary.variants.updated++;
        }
      }
    }

    // What's left are Variants removed from their files, or whose Question's file was deleted.
    for (const variant of storedVariants.values()) {
      await tx
        .delete(questionVariants)
        .where(matchesVariant(variant.questionId, variant.seniorityLevel));
      summary.variants.deleted++;
    }
    const bankIds = new Set(bank.map((question) => question.id));
    const removedIds = [...storedQuestions.keys()].filter((id) => !bankIds.has(id));
    if (removedIds.length > 0) {
      await tx.delete(questions).where(inArray(questions.id, removedIds));
      summary.questions.deleted += removedIds.length;
    }
  });

  return summary;
}

type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

function variantKey(questionId: string, seniorityLevel: SeniorityLevel | null) {
  return `${questionId}/${seniorityLevel ?? ''}`;
}

function matchesVariant(questionId: string, seniorityLevel: SeniorityLevel | null) {
  return and(
    eq(questionVariants.questionId, questionId),
    seniorityLevel === null
      ? isNull(questionVariants.seniorityLevel)
      : eq(questionVariants.seniorityLevel, seniorityLevel),
  );
}

function isEqualArray(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

async function readQuestionBank(contentDir: string): Promise<Question[]> {
  const entries = await readdir(contentDir, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .toSorted();

  const bank: Question[] = [];
  const problems: string[] = [];
  // Question id -> the files declaring it, read even from files that fail validation so that a
  // duplicate is reported in the same run as their other problems.
  const idFiles = new Map<string, string[]>();
  for (const file of files) {
    const label = path.relative(contentDir, file);
    let parsed;
    try {
      parsed = matter(await readFile(file, 'utf8'));
    } catch (error) {
      // Malformed YAML frontmatter.
      problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const { data, content } = parsed;
    const explanation = content.trim();
    const result = questionFileSchema.safeParse(data);

    if (!explanation) {
      problems.push(`${label}: the Explanation (markdown body) is empty`);
    }
    if (typeof data.id === 'string' && data.id.trim()) {
      const id = data.id.trim();
      idFiles.set(id, [...(idFiles.get(id) ?? []), label]);
    }
    if (!result.success) {
      for (const issue of result.error.issues) {
        const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        problems.push(`${label}: ${where}${issue.message}`);
      }
    } else if (explanation) {
      bank.push({ ...result.data, explanation });
    }
  }
  for (const [id, labels] of idFiles) {
    if (labels.length > 1) {
      problems.push(`id "${id}" is declared by more than one file: ${labels.join(', ')}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid question files:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`,
    );
  }
  return bank;
}
