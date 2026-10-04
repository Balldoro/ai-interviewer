import 'server-only';

import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import * as z from 'zod';

import { db } from '@/db';
import { interviewQuestions, interviews, questions, questionVariants } from '@/db/schema';
import { shuffle } from '@/lib/utils';
import { QUESTION_CATEGORIES, type QuestionCategory } from '@/modules/setup/lib/constants';
import type { InterviewSetup } from '@/modules/setup/lib/schema';

export type InterviewStep = {
  position: number;
  questionCount: number;
  questionText: string;
};

export async function startInterview(userId: string, setup: InterviewSetup): Promise<string> {
  return db.transaction(async (tx) => {
    const eligible = await tx
      .select({
        questionId: questions.id,
        category: questions.category,
        // A Variant's own Question Text replaces the Question's default.
        questionText: sql<string>`coalesce(${questionVariants.textOverride}, ${questions.text})`,
        keyPoints: questionVariants.keyPoints,
      })
      .from(questions)
      .innerJoin(questionVariants, eq(questionVariants.questionId, questions.id))
      .where(
        and(
          // A Question has either levelled Variants or one level-agnostic Variant, so at most one
          // of them matches.
          or(
            eq(questionVariants.seniorityLevel, setup.seniorityLevel),
            isNull(questionVariants.seniorityLevel),
          ),
          setup.category === 'mixed' ? undefined : eq(questions.category, setup.category),
        ),
      );

    const picked = Object.entries(questionsPerCategory(setup)).flatMap(([category, count]) =>
      shuffle(eligible.filter((question) => question.category === category)).slice(0, count),
    );

    const [interview] = await tx
      .insert(interviews)
      .values({
        userId,
        seniorityLevel: setup.seniorityLevel,
        category: setup.category,
        questionCount: setup.questionCount,
      })
      .returning({ id: interviews.id });

    await tx.insert(interviewQuestions).values(
      // Shuffled again so that Mixed's Categories are interleaved rather than asked in blocks.
      shuffle(picked).map(({ questionId, questionText, keyPoints }, i) => ({
        interviewId: interview.id,
        position: i + 1,
        questionId,
        questionText,
        keyPoints,
      })),
    );

    return interview.id;
  });
}

/**
 * The User's current step in an Interview, or null when the Interview doesn't exist or belongs to
 * someone else. It never contains Key Points or any other Interview Question.
 */
export async function getInterviewStep(
  userId: string,
  interviewId: string,
): Promise<InterviewStep | null> {
  if (!z.uuid().safeParse(interviewId).success) return null;

  const [step] = await db
    .select({
      position: interviewQuestions.position,
      questionCount: interviews.questionCount,
      questionText: interviewQuestions.questionText,
    })
    .from(interviews)
    .innerJoin(interviewQuestions, eq(interviewQuestions.interviewId, interviews.id))
    .where(and(eq(interviews.id, interviewId), eq(interviews.userId, userId)))
    .orderBy(asc(interviewQuestions.position))
    .limit(1);

  return step ?? null;
}

/**
 * How many Questions to pick from each Category. Mixed splits the Question Count as evenly as
 * possible, giving the remainder to randomly chosen Categories.
 */
function questionsPerCategory({
  category,
  questionCount,
}: InterviewSetup): Partial<Record<QuestionCategory, number>> {
  if (category !== 'mixed') return { [category]: questionCount };

  const base = Math.floor(questionCount / QUESTION_CATEGORIES.length);
  const remainder = questionCount % QUESTION_CATEGORIES.length;

  return Object.fromEntries(
    shuffle(QUESTION_CATEGORIES).map((questionCategory, i) => [
      questionCategory,
      base + (i < remainder ? 1 : 0),
    ]),
  );
}
