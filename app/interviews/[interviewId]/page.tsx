import { notFound } from 'next/navigation';

import { requireUserId } from '@/modules/auth/lib/user';
import { AnswerRecorder } from '@/modules/interviews/components/answer-recorder/answer-recorder';
import { QuestionAudio } from '@/modules/interviews/components/question-audio/question-audio';
import { elevenLabsVoice } from '@/modules/interviews/lib/elevenlabs-voice';
import { getInterviewStep } from '@/modules/interviews/lib/service';

export default async function Interview({ params }: PageProps<'/interviews/[interviewId]'>) {
  const { interviewId } = await params;
  const userId = await requireUserId();

  const step = await getInterviewStep({ voice: elevenLabsVoice, userId, interviewId });

  if (!step) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      <p className="text-sm text-muted-foreground tabular-nums">
        Question {step.position} of {step.questionCount}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{step.questionText}</h1>
      {step.questionAudio && <QuestionAudio src={step.questionAudio} />}
      <AnswerRecorder interviewId={interviewId} position={step.position} />
    </main>
  );
}
