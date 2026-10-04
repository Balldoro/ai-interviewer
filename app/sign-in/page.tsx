import { redirect } from 'next/navigation';

import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';
import { signInWith } from '@/modules/auth/lib/actions';
import { getUserId } from '@/modules/auth/lib/user';

export default async function SignIn({ searchParams }: PageProps<'/sign-in'>) {
  const { error } = await searchParams;

  if (await getUserId()) redirect(ROUTES.setup);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sign in</h1>
        <p className="text-muted-foreground">Sign in to set up and take your interviews.</p>
      </header>
      {error && <ErrorMessage>Signing in didn&apos;t work. Please try again.</ErrorMessage>}
      <div className="flex flex-col gap-3">
        <form action={signInWith.bind(null, 'github')}>
          <Button type="submit" variant="outline" size="lg" className="w-full">
            Continue with GitHub
          </Button>
        </form>
        <form action={signInWith.bind(null, 'google')}>
          <Button type="submit" variant="outline" size="lg" className="w-full">
            Continue with Google
          </Button>
        </form>
      </div>
    </main>
  );
}
