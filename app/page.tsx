import { InterviewSetupForm } from '@/components/interview-setup-form';
import { interviewSetupSchema, type InterviewSetup } from '@/lib/interview-setup';

async function logInterviewSetup(setup: InterviewSetup) {
  'use server';

  // Server Functions are reachable directly, so validate the Interview Setup again here.
  console.log('Interview Setup', interviewSetupSchema.parse(setup));
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Set up your interview</h1>
        <p className="text-muted-foreground">
          Choose the level you want to practise at, then start your frontend interview.
        </p>
      </header>
      <InterviewSetupForm onSubmitAction={logInterviewSetup} />
    </main>
  );
}
