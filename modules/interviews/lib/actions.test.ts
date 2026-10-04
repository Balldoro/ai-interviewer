// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { submitAnswerAction } from './actions';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const INTERVIEW_ID = '00000000-0000-4000-8000-000000000002';

const { checkAnswer, logger } = vi.hoisted(() => ({
  checkAnswer: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/modules/auth/lib/user', () => ({ requireUserId: async () => USER_ID }));
vi.mock('@/lib/logger', () => ({ logger }));
vi.mock('./service', () => ({ checkAnswer, startInterview: vi.fn() }));

function answer(fields: Partial<Record<'interviewId' | 'position', string>> = {}) {
  const formData = new FormData();
  formData.set('interviewId', fields.interviewId ?? INTERVIEW_ID);
  formData.set('position', fields.position ?? '1');
  formData.set('audio', new File(['audio'], 'answer.webm', { type: 'audio/webm;codecs=opus' }));
  return formData;
}

beforeEach(() => {
  checkAnswer.mockResolvedValue('accepted');
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('submitAnswerAction', () => {
  it('checks the Answer for the signed-in User and confirms it was received', async () => {
    expect(await submitAnswerAction(answer({ position: '2' }))).toEqual({ received: true });
    expect(checkAnswer).toHaveBeenCalledWith({
      userId: USER_ID,
      interviewId: INTERVIEW_ID,
      position: 2,
    });
  });

  it('asks for a new recording without checking the Answer when the submission is invalid', async () => {
    const formData = answer();
    formData.delete('audio');

    expect(await submitAnswerAction(formData)).toEqual({
      error: "We couldn't send that recording. Please record your answer again.",
    });
    expect(checkAnswer).not.toHaveBeenCalled();
  });

  it.each([
    ['not_found', "We couldn't find this interview."],
    ['not_in_progress', 'This interview is no longer in progress.'],
    [
      'not_current_question',
      'This question isn’t the current one any more. Please reload the page.',
    ],
  ])('explains a rejection for %s and logs it', async (reason, error) => {
    checkAnswer.mockResolvedValue(reason);

    expect(await submitAnswerAction(answer())).toEqual({ error });
    expect(logger.warn).toHaveBeenCalledWith('Answer rejected', {
      interviewId: INTERVIEW_ID,
      position: 1,
      reason,
    });
  });

  it('asks the User to try again and logs the failure when checking the Answer throws', async () => {
    const failure = new Error('Database unavailable');
    checkAnswer.mockRejectedValue(failure);

    expect(await submitAnswerAction(answer())).toEqual({
      error: "We couldn't send your answer. Please try again.",
    });
    expect(logger.error).toHaveBeenCalledWith('Submitting the Answer failed', failure, {
      interviewId: INTERVIEW_ID,
      position: 1,
    });
  });
});
