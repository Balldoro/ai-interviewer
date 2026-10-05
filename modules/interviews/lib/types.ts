// What the User is shown of an Interview: the Interview Question they're on, or that it's completed.
// Upcoming Interview Questions are never part of it (see docs/adr/0002).
export type InterviewStep =
  | {
      type: 'question';
      position: number;
      questionCount: number;
      questionText: string;
      questionAudio: string | null;
    }
  | { type: 'completed' };

export type MicrophoneError = 'denied' | 'unavailable' | 'unsupported' | 'no_audio';

export type AudioRecorderState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'recording' }
  | { status: 'microphone_error'; error: MicrophoneError }
  | { status: 'recorded'; audio: Blob };

export type AudioRecorderStatus = AudioRecorderState['status'];

export type AnswerSubmissionState =
  { status: 'idle' } | { status: 'sending' } | { status: 'error'; error: string };

export type AnswerSubmissionStatus = AnswerSubmissionState['status'];
