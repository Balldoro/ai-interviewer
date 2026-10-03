// Drizzle table definitions. Add tables here, then run `pnpm db:generate` and `pnpm db:migrate`.
import { pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { QUESTION_CATEGORIES, SENIORITY_LEVELS } from '../modules/setup/lib/constants';

// Derived from the Interview Setup values so the two can't drift apart.
export const categoryEnum = pgEnum('category', QUESTION_CATEGORIES);
// Declaration order gives junior < mid < senior.
export const seniorityLevelEnum = pgEnum('seniority_level', SENIORITY_LEVELS);

// Every table enables RLS with no policies, so Supabase's Data API can't reach it even if it's
// turned on. The app connects as the tables' owner, which RLS doesn't apply to.

// Seeded from the question files by `pnpm db:seed` (see docs/adr/0001); don't edit by hand.
export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  category: categoryEnum('category').notNull(),
  text: text('text').notNull(),
  explanation: text('explanation').notNull(),
}).enableRLS();

export const questionVariants = pgTable(
  'question_variants',
  {
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    // NULL means level-agnostic: the Variant is used at every Seniority Level.
    seniorityLevel: seniorityLevelEnum('seniority_level'),
    // NULL means the Question's `text` applies.
    textOverride: text('text_override'),
    keyPoints: text('key_points').array().notNull(),
  },
  // NULLS NOT DISTINCT treats level-agnostic as its own level, so it can't be duplicated either.
  (table) => [unique().on(table.questionId, table.seniorityLevel).nullsNotDistinct()],
).enableRLS();

// One row per User who has signed in, keyed by their Supabase Auth user id. Created by the app
// on sign-in rather than by a trigger on auth.users, and with no foreign key to it, because the
// database may not be the Supabase one.
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
