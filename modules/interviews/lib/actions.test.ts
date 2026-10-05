// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { submitAnswerAction } from './actions';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const INTERVIEW_ID = '00000000-0000-4000-8000-000000000002';
const NEXT_STEP = {
  type: 'question',
  position: 3,
  questionCount: 5,
  questionText: 'What is a closure?',
  questionAudio: 'data:audio/mpeg;base64,c3BlZWNo',
};

const { submitAnswer, logger, TranscriptionFailedError } = vi.hoisted(() => ({
  submitAnswer: vi.fn(),
  TranscriptionFailedError: class extends Error {},
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/modules/auth/lib/user', () => ({ requireUserId: async () => USER_ID }));
vi.mock('@/lib/logger', () => ({ logger }));
vi.mock('./service', () => ({ submitAnswer, startInterview: vi.fn(), TranscriptionFailedError }));
vi.mock('./elevenlabs-voice', () => ({ elevenLabsVoice: { transcribe: vi.fn() } }));

function answer(fields: Partial<Record<'interviewId' | 'position', string>> = {}) {
  const formData = new FormData();
  formData.set('interviewId', fields.interviewId ?? INTERVIEW_ID);
  formData.set('position', fields.position ?? '1');
  formData.set('audio', new File(['audio'], 'answer.webm', { type: 'audio/webm;codecs=opus' }));
  return formData;
}

beforeEach(() => {
  submitAnswer.mockResolvedValue({ outcome: 'stored', nextStep: NEXT_STEP });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('submitAnswerAction', () => {
  it('submits the recording as the signed-in User’s Answer and returns the next step', async () => {
    expect(await submitAnswerAction(answer({ position: '2' }))).toEqual({ nextStep: NEXT_STEP });
    expect(submitAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, interviewId: INTERVIEW_ID, position: 2 }),
    );
    const { audio } = submitAnswer.mock.calls[0][0];
    expect(await audio.text()).toBe('audio');
  });

  it('returns that the Interview is completed after the last Answer', async () => {
    submitAnswer.mockResolvedValue({ outcome: 'stored', nextStep: { type: 'completed' } });

    expect(await submitAnswerAction(answer({ position: '5' }))).toEqual({
      nextStep: { type: 'completed' },
    });
  });

  it('returns the next step for a repeated submit for an answered Interview Question', async () => {
    submitAnswer.mockResolvedValue({ outcome: 'already_answered', nextStep: NEXT_STEP });

    expect(await submitAnswerAction(answer())).toEqual({ nextStep: NEXT_STEP });
  });

  it('returns the current step and logs it when the Answer isn’t for the current question', async () => {
    submitAnswer.mockResolvedValue({ outcome: 'not_current_question', nextStep: NEXT_STEP });

    expect(await submitAnswerAction(answer())).toEqual({ nextStep: NEXT_STEP });
    expect(logger.warn).toHaveBeenCalledWith(
      'Answer sent for a question that isn’t the current one',
      { interviewId: INTERVIEW_ID, position: 1 },
    );
  });

  it('asks for a new recording without submitting the Answer when the submission is invalid', async () => {
    const formData = answer();
    formData.delete('audio');

    expect(await submitAnswerAction(formData)).toEqual({
      error: "We couldn't send that recording. Please record your answer again.",
    });
    expect(submitAnswer).not.toHaveBeenCalled();
  });

  it('asks for a new recording without logging when the User couldn’t be heard', async () => {
    submitAnswer.mockResolvedValue({ outcome: 'not_heard' });

    expect(await submitAnswerAction(answer())).toEqual({
      error: "We couldn't hear you. Please record your answer again.",
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('asks the User to submit the same recording again and logs it when transcription fails', async () => {
    const failure = new Error('Speech-to-text unavailable');
    submitAnswer.mockRejectedValue(
      new TranscriptionFailedError('Transcribing the Answer failed', { cause: failure }),
    );

    expect(await submitAnswerAction(answer())).toEqual({
      error: "We couldn't process your answer. Please try submitting it again.",
    });
    expect(logger.error).toHaveBeenCalledWith('Transcribing the Answer failed', failure, {
      interviewId: INTERVIEW_ID,
      position: 1,
    });
  });

  it.each([
    ['not_found', "We couldn't find this interview."],
    ['not_in_progress', 'This interview is no longer in progress.'],
  ])('explains a rejection for %s and logs it', async (reason, error) => {
    submitAnswer.mockResolvedValue({ outcome: reason });

    expect(await submitAnswerAction(answer())).toEqual({ error });
    expect(logger.warn).toHaveBeenCalledWith('Answer rejected', {
      interviewId: INTERVIEW_ID,
      position: 1,
      reason,
    });
  });

  it('asks the User to try again and logs the failure when submitting the Answer throws', async () => {
    const failure = new Error('Database unavailable');
    submitAnswer.mockRejectedValue(failure);

    expect(await submitAnswerAction(answer())).toEqual({
      error: "We couldn't send your answer. Please try again.",
    });
    expect(logger.error).toHaveBeenCalledWith('Submitting the Answer failed', failure, {
      interviewId: INTERVIEW_ID,
      position: 1,
    });
  });
});
