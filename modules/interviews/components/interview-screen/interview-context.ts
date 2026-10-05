import { createContext, use } from 'react';

import type { InterviewStep } from '../../lib/types';

interface InterviewContextValue {
  interviewId: string;
  position: number;
  onAnswered: (nextStep: InterviewStep) => void;
  // Called when the User starts or stops recording or sending an Answer.
  onAnsweringChange: (isAnswering: boolean) => void;
}

export const InterviewContext = createContext<InterviewContextValue | null>(null);

export function useInterview() {
  const interview = use(InterviewContext);

  if (!interview) throw new Error('useInterview must be used within an InterviewContext');

  return interview;
}
