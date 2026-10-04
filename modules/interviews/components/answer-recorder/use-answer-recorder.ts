import { useState } from 'react';

import { useAudioRecorder } from '../../hooks/use-audio-recorder';
import { MICROPHONE_ERRORS, RECORDING_MESSAGES, SUBMISSION_MESSAGES } from '../../lib/constants';
import { useAnswerSubmission } from './use-answer-submission';

interface UseAnswerRecorderOptions {
  interviewId: string;
  position: number;
}

export function useAnswerRecorder({ interviewId, position }: UseAnswerRecorderOptions) {
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  const submission = useAnswerSubmission({ interviewId, position });

  const recorder = useAudioRecorder();

  const hasSubmitted = submission.state.status === 'sending' || submission.state.status === 'sent';

  const errorMessage =
    recorder.state.status === 'microphone_error'
      ? MICROPHONE_ERRORS[recorder.state.error]
      : submission.state.status === 'error'
        ? submission.state.error
        : null;

  function clickRecordingButton() {
    if (hasSubmitted) return;

    switch (recorder.state.status) {
      case 'idle':
      case 'microphone_error':
        return recorder.start();
      case 'recording':
        return recorder.stop();
      case 'recorded':
        return setIsDiscardDialogOpen(true);
    }
  }

  function confirmDiscard() {
    setIsDiscardDialogOpen(false);
    if (hasSubmitted) return;

    recorder.discard();
    submission.reset();
  }

  function submitAnswer() {
    if (recorder.state.status === 'recorded') submission.submit(recorder.state.audio);
  }

  return {
    recording: recorder.state,
    errorMessage,
    statusMessage:
      SUBMISSION_MESSAGES[submission.state.status] || RECORDING_MESSAGES[recorder.state.status],
    isRecordingDisabled: hasSubmitted,
    canSubmit: recorder.state.status === 'recorded' && !hasSubmitted,
    isDiscardDialogOpen,
    setIsDiscardDialogOpen,
    clickRecordingButton,
    confirmDiscard,
    submitAnswer,
  };
}
