import Link from 'next/link';
import { useId } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';

export function InterviewComplete() {
  const summaryId = useId();

  return (
    <>
      <div id={summaryId} className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Interview complete</h1>
        <p className="text-muted-foreground">You&apos;ve answered every question.</p>
      </div>
      {/* Focused once the last Answer is in, so it also reads out that the Interview is complete. */}
      <Link
        href={ROUTES.setup}
        aria-describedby={summaryId}
        className={buttonVariants({ size: 'lg', className: 'self-start' })}
      >
        Start another interview
      </Link>
    </>
  );
}
