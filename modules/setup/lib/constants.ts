export const SENIORITY_LEVELS = ['junior', 'mid', 'senior'] as const;
export const CATEGORIES = ['javascript', 'react', 'typescript', 'mixed'] as const;
export const QUESTION_COUNT_MIN = 5;
export const QUESTION_COUNT_MAX = 10;

export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];
export type Category = (typeof CATEGORIES)[number];

export const INTERVIEW_SETUP_DEFAULTS = {
  seniorityLevel: 'mid',
  category: 'mixed',
  questionCount: 5,
} satisfies {
  seniorityLevel: SeniorityLevel;
  category: Category;
  questionCount: number;
};

export const SENIORITY_LEVEL_LABELS: Record<SeniorityLevel, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  javascript: 'JavaScript',
  react: 'React',
  typescript: 'TypeScript',
  mixed: 'Mixed',
};
