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
  type AnswerRejection,
} from './service';
import type { InterviewStep } from './types';

export type StartInterviewState = { error: string } | null;

export type SubmitAnswerResult = { nextStep: InterviewStep } | { error: string };

const ANSWER_REJECTED_ERRORS: Record<AnswerRejection, string> = {
  not_heard: "We couldn't hear you. Please record your answer again.",
  not_found: "We couldn't find this interview.",
  not_in_progress: 'This interview is no longer in progress.',
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

export async function submitAnswerAction(formData: FormData): Promise<SubmitAnswerResult> {
  const userId = await requireUserId();
  const parsed = parseAnswerSubmission(formData);

  if (!parsed.success) {
    return { error: "We couldn't send that recording. Please record your answer again." };
  }

  const { interviewId, position, audio } = parsed.data;

  try {
    const result = await submitAnswer({
      voice: elevenLabsVoice,
      userId,
      interviewId,
      position,
      audio,
    });

    if ('nextStep' in result) {
      // The client only ever sends the position it shows, so this points to a bug worth looking into.
      if (result.outcome === 'not_current_question') {
        logger.warn('Answer sent for a question that isn’t the current one', {
          interviewId,
          position,
        });
      }
      return { nextStep: result.nextStep };
    }

    // Silence is an ordinary mistake rather than something worth looking into.
    if (result.outcome !== 'not_heard') {
      logger.warn('Answer rejected', { interviewId, position, reason: result.outcome });
    }
    return { error: ANSWER_REJECTED_ERRORS[result.outcome] };
  } catch (error) {
    if (error instanceof TranscriptionFailedError) {
      logger.error('Transcribing the Answer failed', error.cause, { interviewId, position });
      // The recording is fine, so the User can send the same one again.
      return { error: "We couldn't process your answer. Please try submitting it again." };
    }

    logger.error('Submitting the Answer failed', error, { interviewId, position });
    return { error: "We couldn't send your answer. Please try again." };
  }
}
