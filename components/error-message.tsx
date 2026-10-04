import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

interface ErrorMessageProps extends ComponentProps<'p'> {}

// Announced to screen readers as soon as it appears.
export function ErrorMessage({ className, ...props }: ErrorMessageProps) {
  return <p role="alert" className={cn('text-sm text-destructive', className)} {...props} />;
}
