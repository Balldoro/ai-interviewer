import { z } from 'zod';

export const SENIORITY_LEVELS = ['junior', 'mid', 'senior'] as const;
export const CATEGORIES = ['javascript', 'react', 'typescript', 'mixed'] as const;
export const QUESTION_COUNT_MIN = 3;
export const QUESTION_COUNT_MAX = 10;

export const INTERVIEW_SETUP_DEFAULTS = {
  seniorityLevel: 'mid',
  category: 'mixed',
  questionCount: 5,
} as const;

export const interviewSetupSchema = z.object({
  seniorityLevel: z.enum(SENIORITY_LEVELS).default(INTERVIEW_SETUP_DEFAULTS.seniorityLevel),
  category: z.enum(CATEGORIES).default(INTERVIEW_SETUP_DEFAULTS.category),
  questionCount: z
    .number()
    .int()
    .min(QUESTION_COUNT_MIN)
    .max(QUESTION_COUNT_MAX)
    .default(INTERVIEW_SETUP_DEFAULTS.questionCount),
});

export type InterviewSetup = z.infer<typeof interviewSetupSchema>;
export type SeniorityLevel = InterviewSetup['seniorityLevel'];
export type Category = InterviewSetup['category'];
