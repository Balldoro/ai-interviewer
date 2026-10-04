'use server';

import { redirect } from 'next/navigation';

import { logger } from '@/lib/logger';
import { ROUTES } from '@/lib/routes';
import { requireUserId } from '@/modules/auth/lib/user';
import { parseInterviewSetup } from '@/modules/setup/lib/schema';

import { elevenLabsVoice } from './elevenlabs-voice';
import { parseAnswerSubmission } from './schema';
import {
  startInterview,
  submitAnswer,
  TranscriptionFailedError,
  type AnswerOutcome,
} from './service';

export type StartInterviewState = { error: string } | null;

export type SubmitAnswerResult = { received: true } | { error: string };

const ANSWER_REJECTED_ERRORS: Record<
  Exclude<AnswerOutcome, 'stored' | 'already_answered'>,
  string
> = {
  not_heard: "We couldn't hear you. Please record your answer again.",
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

// Only stores the Answer for now; moving the Interview on comes later.
export async function submitAnswerAction(formData: FormData): Promise<SubmitAnswerResult> {
  const userId = await requireUserId();
  const parsed = parseAnswerSubmission(formData);

  if (!parsed.success) {
    return { error: "We couldn't send that recording. Please record your answer again." };
  }

  const { interviewId, position, audio } = parsed.data;

  try {
    const outcome = await submitAnswer({
      voice: elevenLabsVoice,
      userId,
      interviewId,
      position,
      audio,
    });

    if (outcome !== 'stored' && outcome !== 'already_answered') {
      // Silence is an ordinary mistake rather than something worth looking into.
      if (outcome !== 'not_heard') {
        logger.warn('Answer rejected', { interviewId, position, reason: outcome });
      }
      return { error: ANSWER_REJECTED_ERRORS[outcome] };
    }
  } catch (error) {
    if (error instanceof TranscriptionFailedError) {
      logger.error('Transcribing the Answer failed', error.cause, { interviewId, position });
      // The recording is fine, so the User can send the same one again.
      return { error: "We couldn't process your answer. Please try submitting it again." };
    }

    logger.error('Submitting the Answer failed', error, { interviewId, position });
    return { error: "We couldn't send your answer. Please try again." };
  }

  return { received: true };
}
