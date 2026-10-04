export type MicrophoneError = 'denied' | 'unavailable' | 'unsupported' | 'no_audio';

export type AudioRecorderState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'recording' }
  | { status: 'microphone_error'; error: MicrophoneError }
  | { status: 'recorded'; audio: Blob };

export type AudioRecorderStatus = AudioRecorderState['status'];

export type AnswerSubmissionState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'error'; error: string }
  | { status: 'sent' };

export type AnswerSubmissionStatus = AnswerSubmissionState['status'];
