import { useEffect, useRef, useState } from 'react';

import { releaseMicrophone } from '../../lib/microphone';
import type { InterviewStep } from '../../lib/types';

export function useInterviewScreen(initialStep: InterviewStep) {
  const [step, setStep] = useState(initialStep);
  const [isAnswering, setIsAnswering] = useState(false);

  const controlsRef = useRef<HTMLDivElement>(null);

  const isCompleted = step.type === 'completed';

  // The microphone stays open from one Interview Question to the next (see `openMicrophone`), so it
  // is released once the Interview is completed or left.
  useEffect(() => {
    if (isCompleted) void releaseMicrophone();
    return () => void releaseMicrophone();
  }, [isCompleted]);

  // Moving on replaces the controls, which drops focus to the top of the page, so it is put on the
  // first control of the new step. Not on the first step, which the page load itself announces.
  useEffect(() => {
    if (step === initialStep) return;
    controlsRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus();
  }, [step, initialStep]);

  // The next step's controls start enabled, so that they can take focus.
  function moveOn(nextStep: InterviewStep) {
    setIsAnswering(false);
    setStep(nextStep);
  }

  return { step, moveOn, isAnswering, setIsAnswering, controlsRef };
}
