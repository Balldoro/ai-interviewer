// Drizzle table definitions. Add tables here, then run `pnpm db:generate` and `pnpm db:migrate`.
import { integer, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { CATEGORIES, QUESTION_CATEGORIES, SENIORITY_LEVELS } from '../modules/setup/lib/constants';

// Derived from the Interview Setup values so the two can't drift apart.
export const categoryEnum = pgEnum('category', QUESTION_CATEGORIES);
// Declaration order gives junior < mid < senior.
export const seniorityLevelEnum = pgEnum('seniority_level', SENIORITY_LEVELS);
// An Interview's Category can also be Mixed, which no Question belongs to.
export const interviewCategoryEnum = pgEnum('interview_category', CATEGORIES);
export const interviewStatusEnum = pgEnum('interview_status', [
  'in_progress',
  'completed',
  'abandoned',
]);

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

export const interviews = pgTable('interviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  seniorityLevel: seniorityLevelEnum('seniority_level').notNull(),
  category: interviewCategoryEnum('category').notNull(),
  questionCount: integer('question_count').notNull(),
  status: interviewStatusEnum('status').notNull().default('in_progress'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}).enableRLS();

export const interviewQuestions = pgTable(
  'interview_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interviewId: uuid('interview_id')
      .notNull()
      .references(() => interviews.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    questionId: text('question_id').references(() => questions.id, { onDelete: 'set null' }),
    // The Variant's override if it has one, otherwise the Question's default.
    questionText: text('question_text').notNull(),
    keyPoints: text('key_points').array().notNull(),
  },
  (table) => [unique().on(table.interviewId, table.position)],
).enableRLS();

// Only the transcript of what the User said is kept; the recorded audio never is.
export const answers = pgTable(
  'answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interviewQuestionId: uuid('interview_question_id')
      .notNull()
      .references(() => interviewQuestions.id, { onDelete: 'cascade' }),
    // 0 is the Answer to the Interview Question itself; 1 and up are reserved for Follow-up
    // Questions.
    followUpIndex: integer('follow_up_index').notNull().default(0),
    transcript: text('transcript').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.interviewQuestionId, table.followUpIndex)],
).enableRLS();
