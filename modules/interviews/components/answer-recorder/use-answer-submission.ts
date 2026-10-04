import { useState } from 'react';

import { logger } from '@/lib/logger';

import { submitAnswerAction } from '../../lib/actions';
import type { AnswerSubmissionState } from '../../lib/types';

// The server received the Answer but turned it down, e.g. because the Interview has finished.
class AnswerRejectedError extends Error {}

function fileExtensionOf(mimeType: string) {
  if (mimeType.startsWith('audio/ogg')) return 'ogg';
  if (mimeType.startsWith('audio/mp4')) return 'mp4';
  return 'webm';
}

interface UseAnswerSubmissionOptions {
  interviewId: string;
  position: number;
}

export function useAnswerSubmission({ interviewId, position }: UseAnswerSubmissionOptions) {
  const [state, setState] = useState<AnswerSubmissionState>({ status: 'idle' });

  async function submit(audio: Blob) {
    if (state.status === 'sending' || state.status === 'sent') return;

    const formData = new FormData();
    formData.set('interviewId', interviewId);
    formData.set('position', String(position));
    formData.set('audio', audio, `answer.${fileExtensionOf(audio.type)}`);

    setState({ status: 'sending' });

    try {
      const result = await submitAnswerAction(formData);

      if ('error' in result) throw new AnswerRejectedError(result.error);

      setState({ status: 'sent' });
    } catch (error) {
      const isRejected = error instanceof AnswerRejectedError;

      if (!isRejected) logger.error('Sending the Answer failed', error, { interviewId, position });

      setState({
        status: 'error',
        error: isRejected ? error.message : "We couldn't send your answer. Please try again.",
      });
    }
  }

  function reset() {
    if (state.status === 'error') setState({ status: 'idle' });
  }

  return { state, submit, reset };
}
