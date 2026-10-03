import { logger } from '@/lib/logger';
import { requireUserId } from '@/modules/auth/lib/user';
import { SignOutButton } from '@/modules/auth/components/sign-out-button';
import { SetupForm } from '@/modules/setup/components/setup-form/setup-form';
import { parseInterviewSetup } from '@/modules/setup/lib/schema';

async function logInterviewSetup(formData: FormData) {
  'use server';

  const userId = await requireUserId();

  logger.info('Interview Setup submitted', { userId, setup: parseInterviewSetup(formData) });
}

export default async function Home() {
  await requireUserId();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Set up your interview
          </h1>
          <SignOutButton />
        </div>
        <p className="text-muted-foreground">
          Choose the level you want to practise at, then start your frontend interview.
        </p>
      </header>
      <SetupForm onSubmitAction={logInterviewSetup} />
    </main>
  );
}
