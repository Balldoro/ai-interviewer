import type { AnswerSubmissionStatus, AudioRecorderStatus, MicrophoneError } from './types';

export const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
export const AUDIO_BITS_PER_SECOND = 32_000;
export const MAX_RECORDING_SECONDS = 3 * 60;

export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4'];
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

export const MICROPHONE_ERRORS: Record<MicrophoneError, string> = {
  denied:
    'Microphone access was denied. Allow it for this site in your browser’s settings, then try again.',
  unavailable:
    "We couldn't use your microphone. Check that one is connected and not in use by another app, then try again.",
  unsupported:
    "This browser can't record audio. Try a recent version of Chrome, Edge, Firefox or Safari.",
  no_audio: "We didn't capture any audio. Please try recording again.",
};

export const RECORDING_MESSAGES: Record<AudioRecorderStatus, string> = {
  idle: '',
  starting: 'Waiting for microphone access…',
  recording: 'Recording…',
  microphone_error: '',
  recorded: 'Your answer is recorded. Submit it, or discard it and record again.',
};

export const SUBMISSION_MESSAGES: Record<AnswerSubmissionStatus, string> = {
  idle: '',
  sending: 'Sending your answer…',
  error: '',
  sent: 'Your answer was sent.',
};
