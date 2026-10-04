import { useActionState, useState } from 'react';

import { startInterviewAction } from '@/modules/interviews/lib/actions';

import {
  INTERVIEW_SETUP_DEFAULTS,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
} from '../../lib/constants';

function clampQuestionCount(count: number) {
  return Math.min(QUESTION_COUNT_MAX, Math.max(QUESTION_COUNT_MIN, count));
}

/**
 * Holds the Question Count, which the slider and the −/+ buttons share, and tracks whether the
 * submitted form is still being handled or failed. The server validates the Interview Setup.
 */
export function useSetupForm() {
  const [questionCount, setQuestionCount] = useState(INTERVIEW_SETUP_DEFAULTS.questionCount);

  function changeQuestionCount(count: number) {
    setQuestionCount(clampQuestionCount(count));
  }

  const [state, formAction, isPending] = useActionState(startInterviewAction, null);

  return { questionCount, changeQuestionCount, formAction, isPending, error: state?.error };
}
