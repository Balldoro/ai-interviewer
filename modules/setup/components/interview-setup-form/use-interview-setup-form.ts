import { useActionState, useState } from 'react';
import { z } from 'zod';

import {
  INTERVIEW_SETUP_DEFAULTS,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
  interviewSetupSchema,
  type InterviewSetup,
} from '@/modules/setup/lib/interview-setup';

export type SubmitInterviewSetup = (setup: InterviewSetup) => Promise<void>;

const FIELD_ERRORS: Record<keyof InterviewSetup, string> = {
  seniorityLevel: 'Choose a Seniority Level.',
  category: 'Choose a Category.',
  questionCount: `Choose between ${QUESTION_COUNT_MIN} and ${QUESTION_COUNT_MAX} questions.`,
};

type FieldErrors = Partial<Record<keyof InterviewSetup, string>>;

function clampQuestionCount(count: number) {
  return Math.min(QUESTION_COUNT_MAX, Math.max(QUESTION_COUNT_MIN, count));
}

/**
 * Holds the Question Count, which the slider and the −/+ buttons share, and validates the submitted
 * Interview Setup before passing it to `onSubmitAction`.
 */
export function useInterviewSetupForm(onSubmitAction: SubmitInterviewSetup) {
  const [questionCount, setQuestionCount] = useState(INTERVIEW_SETUP_DEFAULTS.questionCount);

  function changeQuestionCount(count: number) {
    setQuestionCount(clampQuestionCount(count));
  }

  const [errors, formAction, isPending] = useActionState(
    async (_previousErrors: FieldErrors, formData: FormData): Promise<FieldErrors> => {
      const result = interviewSetupSchema.safeParse({
        seniorityLevel: formData.get('seniorityLevel'),
        category: formData.get('category'),
        questionCount: Number(formData.get('questionCount')),
      });
      if (!result.success) {
        const fieldErrors = z.flattenError(result.error).fieldErrors;
        return Object.fromEntries(
          Object.keys(fieldErrors).map((field) => [
            field,
            FIELD_ERRORS[field as keyof InterviewSetup],
          ]),
        );
      }

      await onSubmitAction(result.data);
      return {};
    },
    {},
  );

  return { questionCount, changeQuestionCount, errors, formAction, isPending };
}
