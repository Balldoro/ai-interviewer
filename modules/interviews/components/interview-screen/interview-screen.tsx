'use client';

import type { InterviewStep } from '../../lib/types';
import { AnswerRecorder } from '../answer-recorder/answer-recorder';
import { InterviewComplete } from '../interview-complete';
import { QuestionAudio } from '../question-audio/question-audio';
import { InterviewContext } from './interview-context';
import { useInterviewScreen } from './use-interview-screen';

interface InterviewScreenProps {
  interviewId: string;
  initialStep: InterviewStep;
}

// Moves on to the step the server sends back after each Answer, without reloading the page.
export function InterviewScreen({ interviewId, initialStep }: InterviewScreenProps) {
  const { step, moveOn, isAnswering, setIsAnswering, controlsRef } =
    useInterviewScreen(initialStep);

  if (step.type === 'completed') {
    return (
      <div ref={controlsRef} className="flex flex-col gap-6">
        <InterviewComplete />
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-muted-foreground tabular-nums">
        Question {step.position} of {step.questionCount}
      </p>
      {/* Not keyed, so that a screen reader announces the next Interview Question as it replaces this one. */}
      <h1 aria-live="polite" className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {step.questionText}
      </h1>
      {/* Keyed so each Interview Question starts afresh: the recorder is emptied, and the audio plays
          even when it matches the previous Interview Question's. */}
      <InterviewContext
        key={step.position}
        value={{
          interviewId,
          position: step.position,
          onAnswered: moveOn,
          onAnsweringChange: setIsAnswering,
        }}
      >
        <div ref={controlsRef} className="flex flex-col gap-6">
          {step.questionAudio && <QuestionAudio src={step.questionAudio} disabled={isAnswering} />}
          <AnswerRecorder />
        </div>
      </InterviewContext>
    </>
  );
}
