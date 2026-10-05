import { useEffect, useState } from 'react';

import { useAudioRecorder } from '../../hooks/use-audio-recorder';
import { MICROPHONE_ERRORS, RECORDING_MESSAGES, SUBMISSION_MESSAGES } from '../../lib/constants';
import { getQuestionAudioPlayer } from '../../lib/question-audio-player';
import { useInterview } from '../interview-screen/interview-context';
import { useAnswerSubmission } from './use-answer-submission';

export function useAnswerRecorder() {
  const { onAnsweringChange } = useInterview();

  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  const submission = useAnswerSubmission();

  const recorder = useAudioRecorder();

  const isSending = submission.state.status === 'sending';
  const isAnswering =
    isSending || recorder.state.status === 'starting' || recorder.state.status === 'recording';

  // E.g. so that the Question Audio can't be replayed over the Answer.
  useEffect(() => onAnsweringChange(isAnswering), [isAnswering, onAnsweringChange]);

  const errorMessage =
    recorder.state.status === 'microphone_error'
      ? MICROPHONE_ERRORS[recorder.state.error]
      : submission.state.status === 'error'
        ? submission.state.error
        : null;

  function clickRecordingButton() {
    if (isSending) return;

    switch (recorder.state.status) {
      case 'idle':
      case 'microphone_error':
        // The AI interviewer stops talking once the User starts answering.
        getQuestionAudioPlayer().pause();
        return recorder.start();
      case 'recording':
        return recorder.stop();
      case 'recorded':
        return setIsDiscardDialogOpen(true);
    }
  }

  function confirmDiscard() {
    setIsDiscardDialogOpen(false);
    if (isSending) return;

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
    isRecordingDisabled: isSending,
    canSubmit: recorder.state.status === 'recorded' && !isSending,
    isDiscardDialogOpen,
    setIsDiscardDialogOpen,
    clickRecordingButton,
    stopRecording: recorder.stop,
    confirmDiscard,
    submitAnswer,
  };
}
