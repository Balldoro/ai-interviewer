import 'server-only';

import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import * as z from 'zod';

import { db } from '@/db';
import { answers, interviewQuestions, interviews, questions, questionVariants } from '@/db/schema';
import { logger } from '@/lib/logger';
import { shuffle } from '@/lib/utils';
import { QUESTION_CATEGORIES, type QuestionCategory } from '@/modules/setup/lib/constants';
import type { InterviewSetup } from '@/modules/setup/lib/schema';

import type { InterviewStep } from './types';
import type { Voice } from './voice';

export type AnswerRejection = 'not_heard' | 'not_found' | 'not_in_progress';

export type AnswerOutcome =
  | { outcome: 'stored' | 'already_answered' | 'not_current_question'; nextStep: InterviewStep }
  | { outcome: AnswerRejection };

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
 * The User's current step in an Interview: the first Interview Question without an Answer, or
 * `completed` once every one has an Answer. Null when the Interview doesn't exist or belongs to
 * someone else. It never contains Key Points or any other Interview Question.
 */
export async function getInterviewStep({
  voice,
  userId,
  interviewId,
}: GetInterviewStepParams): Promise<InterviewStep | null> {
  const progress = await findProgress({ userId, interviewId });

  return progress && currentStepOf({ voice, interviewId, progress });
}

/**
 * Transcribes the recording, stores the text as the Answer to the current Interview Question and
 * returns the step that follows. The Answer to the last Interview Question completes the Interview.
 * The audio itself is never stored. Nothing is stored when the Interview Question already has an
 * Answer, though the step that follows is returned all the same, or when the recording holds no
 * speech. Nothing is stored either when the speech service fails, in which case it throws
 * `TranscriptionFailedError`.
 */
export async function submitAnswer({
  voice,
  userId,
  interviewId,
  position,
  audio,
}: SubmitAnswerParams): Promise<AnswerOutcome> {
  const progress = await findProgress({ userId, interviewId });

  if (!progress) return { outcome: 'not_found' };
  if (progress.status === 'abandoned') return { outcome: 'not_in_progress' };

  // A repeated submit, e.g. a retry after a dropped connection, gets the same step as the first.
  if (progress.questions.find((question) => question.position === position)?.isAnswered) {
    return {
      outcome: 'already_answered',
      nextStep: await currentStepOf({ voice, interviewId, progress }),
    };
  }

  if (progress.status !== 'in_progress') return { outcome: 'not_in_progress' };

  const current = progress.questions.find((question) => !question.isAnswered);

  // The User is put back on the current step rather than left stuck on a question they can't answer.
  if (current?.position !== position) {
    return {
      outcome: 'not_current_question',
      nextStep: await currentStepOf({ voice, interviewId, progress }),
    };
  }

  let transcript: string;
  try {
    transcript = (await voice.transcribe(audio)).trim();
  } catch (error) {
    throw new TranscriptionFailedError('Transcribing the Answer failed', { cause: error });
  }

  if (!transcript) return { outcome: 'not_heard' };

  // Only the current Interview Question can be answered, so the progress after it follows from the
  // progress already read.
  const answered = {
    ...progress,
    questions: progress.questions.map((question) =>
      question === current ? { ...question, isAnswered: true } : question,
    ),
  };

  const outcome = await db.transaction(async (tx) => {
    // A submit racing this one may have stored its Answer since the check above.
    const stored = await tx
      .insert(answers)
      .values({ interviewQuestionId: current.interviewQuestionId, transcript })
      .onConflictDoNothing()
      .returning({ id: answers.id });

    if (stored.length === 0) return 'already_answered';

    if (!currentQuestionOf(answered)) {
      await tx
        .update(interviews)
        .set({ status: 'completed', finishedAt: sql`now()` })
        .where(eq(interviews.id, interviewId));
    }

    return 'stored';
  });

  // Spoken once the Answer is stored, so the transaction isn't held open while speech is made.
  return { outcome, nextStep: await currentStepOf({ voice, interviewId, progress: answered }) };
}

type Progress = NonNullable<Awaited<ReturnType<typeof findProgress>>>;

// The Interview's status, plus each Interview Question's Question Text and whether it has an Answer.
async function findProgress({ userId, interviewId }: InterviewParams) {
  if (!z.uuid().safeParse(interviewId).success) return null;

  const rows = await db
    .select({
      status: interviews.status,
      questionCount: interviews.questionCount,
      interviewQuestionId: interviewQuestions.id,
      position: interviewQuestions.position,
      questionText: interviewQuestions.questionText,
      isAnswered: sql<boolean>`${answers.id} is not null`,
    })
    .from(interviews)
    .innerJoin(interviewQuestions, eq(interviewQuestions.interviewId, interviews.id))
    .leftJoin(
      answers,
      and(eq(answers.interviewQuestionId, interviewQuestions.id), eq(answers.followUpIndex, 0)),
    )
    .where(and(eq(interviews.id, interviewId), eq(interviews.userId, userId)))
    .orderBy(asc(interviewQuestions.position));

  if (rows.length === 0) return null;

  const [{ status, questionCount }] = rows;
  return {
    status,
    questionCount,
    questions: rows.map(({ interviewQuestionId, position, questionText, isAnswered }) => ({
      interviewQuestionId,
      position,
      questionText,
      isAnswered,
    })),
  };
}

function currentQuestionOf(progress: Progress) {
  return progress.questions.find((question) => !question.isAnswered);
}

/**
 * The step the progress is at, with its Question Text spoken. When the speech service fails, the
 * step comes without audio so the Interview can carry on.
 */
async function currentStepOf({
  voice,
  interviewId,
  progress,
}: {
  voice: Voice;
  interviewId: string;
  progress: Progress;
}): Promise<InterviewStep> {
  const current = currentQuestionOf(progress);

  if (!current) return { type: 'completed' };

  const { position, questionText } = current;

  let questionAudio: string | null = null;
  try {
    questionAudio = await toDataUrl(await voice.speak(questionText));
  } catch (error) {
    logger.error('Speaking the Interview Question failed', error, { interviewId, position });
  }

  return {
    type: 'question',
    position,
    questionCount: progress.questionCount,
    questionText,
    questionAudio,
  };
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
