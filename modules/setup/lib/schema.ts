import { z } from 'zod';

import {
  CATEGORIES,
  INTERVIEW_SETUP_DEFAULTS,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
  SENIORITY_LEVELS,
} from './constants';

const interviewSetupSchema = z.object({
  seniorityLevel: z.enum(SENIORITY_LEVELS).default(INTERVIEW_SETUP_DEFAULTS.seniorityLevel),
  category: z.enum(CATEGORIES).default(INTERVIEW_SETUP_DEFAULTS.category),
  // Form values arrive as strings.
  questionCount: z.coerce
    .number()
    .int()
    .min(QUESTION_COUNT_MIN)
    .max(QUESTION_COUNT_MAX)
    .default(INTERVIEW_SETUP_DEFAULTS.questionCount),
});

export type InterviewSetup = z.infer<typeof interviewSetupSchema>;

export function parseInterviewSetup(formData: FormData) {
  return interviewSetupSchema.parse(Object.fromEntries(formData));
}
