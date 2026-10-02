import { useActionState, useState } from 'react';

import {
  INTERVIEW_SETUP_DEFAULTS,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
} from '../../lib/constants';

export type SubmitSetupForm = (formData: FormData) => Promise<void>;

function clampQuestionCount(count: number) {
  return Math.min(QUESTION_COUNT_MAX, Math.max(QUESTION_COUNT_MIN, count));
}

/**
 * Holds the Question Count, which the slider and the −/+ buttons share, and tracks whether the
 * submitted form is still being handled. The server validates the Interview Setup.
 */
export function useSetupForm(onSubmitAction: SubmitSetupForm) {
  const [questionCount, setQuestionCount] = useState(INTERVIEW_SETUP_DEFAULTS.questionCount);

  function changeQuestionCount(count: number) {
    setQuestionCount(clampQuestionCount(count));
  }

  const [, formAction, isPending] = useActionState(
    (_previousState: void, formData: FormData) => onSubmitAction(formData),
    undefined,
  );

  return { questionCount, changeQuestionCount, formAction, isPending };
}
