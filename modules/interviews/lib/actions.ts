'use server';

import { redirect } from 'next/navigation';

import { logger } from '@/lib/logger';
import { ROUTES } from '@/lib/routes';
import { requireUserId } from '@/modules/auth/lib/user';
import { parseInterviewSetup } from '@/modules/setup/lib/schema';

import { parseAnswerSubmission } from './schema';
import { checkAnswer, startInterview, type AnswerCheck } from './service';

export type StartInterviewState = { error: string } | null;

export type SubmitAnswerResult = { received: true } | { error: string };

const ANSWER_REJECTED_ERRORS: Record<Exclude<AnswerCheck, 'accepted'>, string> = {
  not_found: "We couldn't find this interview.",
  not_in_progress: 'This interview is no longer in progress.',
  not_current_question: 'This question isn’t the current one any more. Please reload the page.',
};

export async function startInterviewAction(
  _previousState: StartInterviewState,
  formData: FormData,
): Promise<StartInterviewState> {
  const userId = await requireUserId();
  const parsed = parseInterviewSetup(formData);

  if (!parsed.success) {
    return { error: 'That Interview Setup isn’t valid. Please reload the page and try again.' };
  }

  const setup = parsed.data;

  let interviewId: string;
  try {
    interviewId = await startInterview({ userId, setup });
  } catch (error) {
    logger.error('Starting the Interview failed', error, { setup });
    return { error: "We couldn't start your interview. Please try again." };
  }

  redirect(ROUTES.interview(interviewId));
}

// Only checks the Answer for now; storing it and moving the Interview on come later.
export async function submitAnswerAction(formData: FormData): Promise<SubmitAnswerResult> {
  const userId = await requireUserId();
  const parsed = parseAnswerSubmission(formData);

  if (!parsed.success) {
    return { error: "We couldn't send that recording. Please record your answer again." };
  }

  const { interviewId, position } = parsed.data;

  try {
    const check = await checkAnswer({ userId, interviewId, position });

    if (check !== 'accepted') {
      logger.warn('Answer rejected', { interviewId, position, reason: check });
      return { error: ANSWER_REJECTED_ERRORS[check] };
    }
  } catch (error) {
    logger.error('Submitting the Answer failed', error, { interviewId, position });
    return { error: "We couldn't send your answer. Please try again." };
  }

  return { received: true };
}
