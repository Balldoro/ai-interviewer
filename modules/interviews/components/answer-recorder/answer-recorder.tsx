'use client';

import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { DiscardRecordingDialog } from './discard-recording-dialog';
import { RecordingButton } from './recording-button';
import { useAnswerRecorder } from './use-answer-recorder';

interface AnswerRecorderProps {
  interviewId: string;
  position: number;
}

export function AnswerRecorder({ interviewId, position }: AnswerRecorderProps) {
  const {
    recording,
    errorMessage,
    statusMessage,
    isRecordingDisabled,
    canSubmit,
    isDiscardDialogOpen,
    setIsDiscardDialogOpen,
    clickRecordingButton,
    confirmDiscard,
    submitAnswer,
  } = useAnswerRecorder({ interviewId, position });

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
      {/* One slot for the status and the error, sized to a line so neither shifts the layout. */}
      <div className="min-h-5">
        {errorMessage ? (
          <ErrorMessage>{errorMessage}</ErrorMessage>
        ) : (
          <output className="text-sm text-muted-foreground">{statusMessage}</output>
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
