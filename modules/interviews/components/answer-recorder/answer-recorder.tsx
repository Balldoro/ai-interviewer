'use client';

import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { MAX_RECORDING_SECONDS } from '../../lib/constants';
import { DiscardRecordingDialog } from './discard-recording-dialog';
import { RecordingButton } from './recording-button';
import { RecordingTimer } from './recording-timer/recording-timer';
import { useAnswerRecorder } from './use-answer-recorder';

export function AnswerRecorder() {
  const {
    recording,
    errorMessage,
    statusMessage,
    isRecordingDisabled,
    canSubmit,
    isDiscardDialogOpen,
    setIsDiscardDialogOpen,
    clickRecordingButton,
    stopRecording,
    confirmDiscard,
    submitAnswer,
  } = useAnswerRecorder();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <RecordingButton
          status={recording.status}
          disabled={isRecordingDisabled}
          onClick={clickRecordingButton}
        />
        <Button type="button" size="lg" disabled={!canSubmit} onClick={submitAnswer}>
          Submit answer
        </Button>
      </div>
      <div className="flex min-h-5 justify-between gap-4">
        {errorMessage ? (
          <ErrorMessage>{errorMessage}</ErrorMessage>
        ) : (
          <output className="text-sm text-muted-foreground">{statusMessage}</output>
        )}
        {recording.status === 'recording' && (
          <RecordingTimer maxSeconds={MAX_RECORDING_SECONDS} onLimitReach={stopRecording} />
        )}
      </div>
      <DiscardRecordingDialog
        open={isDiscardDialogOpen}
        onOpenChange={setIsDiscardDialogOpen}
        onConfirm={confirmDiscard}
      />
    </div>
  );
}
