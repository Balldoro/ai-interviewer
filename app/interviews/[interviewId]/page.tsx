import { notFound } from 'next/navigation';

import { requireUserId } from '@/modules/auth/lib/user';
import { InterviewScreen } from '@/modules/interviews/components/interview-screen/interview-screen';
import { elevenLabsVoice } from '@/modules/interviews/lib/elevenlabs-voice';
import { getInterviewStep } from '@/modules/interviews/lib/service';

export default async function Interview({ params }: PageProps<'/interviews/[interviewId]'>) {
  const { interviewId } = await params;
  const userId = await requireUserId();

  const step = await getInterviewStep({ voice: elevenLabsVoice, userId, interviewId });

  if (!step) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      <InterviewScreen interviewId={interviewId} initialStep={step} />
    </main>
  );
}
