import 'server-only';

import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import * as z from 'zod';

import { db } from '@/db';
import { answers, interviewQuestions, interviews, questions, questionVariants } from '@/db/schema';
import { logger } from '@/lib/logger';
import { shuffle } from '@/lib/utils';
import { QUESTION_CATEGORIES, type QuestionCategory } from '@/modules/setup/lib/constants';
import type { InterviewSetup } from '@/modules/setup/lib/schema';

import type { Voice } from './voice';

export type InterviewStep = {
  position: number;
  questionCount: number;
  questionText: string;
  // The Question Text spoken by the AI interviewer, as a data URL. Null when speech failed.
  questionAudio: string | null;
};

export type AnswerOutcome =
  | 'stored'
  | 'already_answered'
  | 'not_heard'
  | 'not_found'
  | 'not_in_progress'
  | 'not_current_question';

// The speech service failed, as opposed to the recording holding no speech (`not_heard`).
export class TranscriptionFailedError extends Error {}

export interface InterviewParams {
  userId: string;
  interviewId: string;
}

export interface GetInterviewStepParams extends InterviewParams {
  voice: Voice;
}

export interface SubmitAnswerParams extends InterviewParams {
  voice: Voice;
  position: number;
  audio: Blob;
}

export interface StartInterviewParams {
  userId: string;
  setup: InterviewSetup;
}

export async function startInterview({ userId, setup }: StartInterviewParams): Promise<string> {
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
 * someone else. It never contains Key Points or any other Interview Question. When the speech
 * service fails, the step comes without audio so the Interview can carry on.
 */
export async function getInterviewStep({
  voice,
  userId,
  interviewId,
}: GetInterviewStepParams): Promise<InterviewStep | null> {
  const current = await findCurrentStep({ userId, interviewId });

  if (!current) return null;

  const { position, questionCount, questionText } = current;

  let questionAudio: string | null = null;
  try {
    questionAudio = await toDataUrl(await voice.speak(questionText));
  } catch (error) {
    logger.error('Speaking the Interview Question failed', error, { interviewId, position });
  }

  return { position, questionCount, questionText, questionAudio };
}

/**
 * Transcribes the recording and stores the text as the Answer to the current Interview Question.
 * The audio itself is never stored. Nothing is stored when the Interview Question already has an
 * Answer or the recording holds no speech, and nothing is stored when the speech service fails, in
 * which case it throws `TranscriptionFailedError`.
 */
export async function submitAnswer({
  voice,
  userId,
  interviewId,
  position,
  audio,
}: SubmitAnswerParams): Promise<AnswerOutcome> {
  const current = await findCurrentStep({ userId, interviewId });

  if (!current) return 'not_found';
  if (current.status !== 'in_progress') return 'not_in_progress';
  if (current.position !== position) return 'not_current_question';
  if (current.isAnswered) return 'already_answered';

  let transcript: string;
  try {
    transcript = (await voice.transcribe(audio)).trim();
  } catch (error) {
    throw new TranscriptionFailedError('Transcribing the Answer failed', { cause: error });
  }

  if (!transcript) return 'not_heard';

  // A submit racing this one may have stored its Answer since the check above.
  const stored = await db
    .insert(answers)
    .values({ interviewQuestionId: current.interviewQuestionId, transcript })
    .onConflictDoNothing()
    .returning({ id: answers.id });

  return stored.length > 0 ? 'stored' : 'already_answered';
}

// Until the Interview moves on after an Answer, the current Interview Question is always the first
// one.
async function findCurrentStep({ userId, interviewId }: InterviewParams) {
  if (!z.uuid().safeParse(interviewId).success) return null;

  const [step] = await db
    .select({
      interviewQuestionId: interviewQuestions.id,
      position: interviewQuestions.position,
      questionCount: interviews.questionCount,
      questionText: interviewQuestions.questionText,
      status: interviews.status,
      isAnswered: sql<boolean>`${answers.id} is not null`,
    })
    .from(interviews)
    .innerJoin(interviewQuestions, eq(interviewQuestions.interviewId, interviews.id))
    .leftJoin(
      answers,
      and(eq(answers.interviewQuestionId, interviewQuestions.id), eq(answers.followUpIndex, 0)),
    )
    .where(and(eq(interviews.id, interviewId), eq(interviews.userId, userId)))
    .orderBy(asc(interviewQuestions.position))
    .limit(1);

  return step ?? null;
}

async function toDataUrl(blob: Blob) {
  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
  return `data:${blob.type};base64,${base64}`;
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
