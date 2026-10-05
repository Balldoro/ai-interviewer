import { useState } from 'react';

import { logger } from '@/lib/logger';

import { submitAnswerAction } from '../../lib/actions';
import type { AnswerSubmissionState, InterviewStep } from '../../lib/types';
import { useInterview } from '../interview-screen/interview-context';

// The server received the Answer but turned it down, e.g. because the Interview has finished.
class AnswerRejectedError extends Error {}

function fileExtensionOf(mimeType: string) {
  if (mimeType.startsWith('audio/ogg')) return 'ogg';
  if (mimeType.startsWith('audio/mp4')) return 'mp4';
  return 'webm';
}

export function useAnswerSubmission() {
  const { interviewId, position, onAnswered } = useInterview();

  const [state, setState] = useState<AnswerSubmissionState>({ status: 'idle' });

  async function submit(audio: Blob) {
    if (state.status === 'sending') return;

    const formData = new FormData();
    formData.set('interviewId', interviewId);
    formData.set('position', String(position));
    formData.set('audio', audio, `answer.${fileExtensionOf(audio.type)}`);

    setState({ status: 'sending' });

    let nextStep: InterviewStep;
    try {
      const result = await submitAnswerAction(formData);

      if ('error' in result) throw new AnswerRejectedError(result.error);

      nextStep = result.nextStep;
    } catch (error) {
      const isRejected = error instanceof AnswerRejectedError;

      if (!isRejected) logger.error('Sending the Answer failed', error, { interviewId, position });

      setState({
        status: 'error',
        error: isRejected ? error.message : "We couldn't send your answer. Please try again.",
      });
      return;
    }

    // The status stays `sending` until the next step replaces this recorder, so the Answer can't be
    // sent twice.
    onAnswered(nextStep);
  }

  function reset() {
    if (state.status === 'error') setState({ status: 'idle' });
  }

  return { state, submit, reset };
}
