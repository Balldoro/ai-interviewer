'use server';

import { redirect } from 'next/navigation';

import { logger } from '@/lib/logger';
import { ROUTES } from '@/lib/routes';
import { requireUserId } from '@/modules/auth/lib/user';
import { parseInterviewSetup } from '@/modules/setup/lib/schema';

import { startInterview } from './service';

export type StartInterviewState = { error: string } | null;

export async function startInterviewAction(
  _previousState: StartInterviewState,
  formData: FormData,
): Promise<StartInterviewState> {
  const userId = await requireUserId();
  const parsed = parseInterviewSetup(formData);

  if (!parsed.success) {
    return { error: 'That Interview Setup isn’t valid. Please reload the page and try again.' };
  }

  const setup = parsed.data;

  let interviewId: string;
  try {
    interviewId = await startInterview(userId, setup);
  } catch (error) {
    logger.error('Starting the Interview failed', error, { setup });
    return { error: "We couldn't start your interview. Please try again." };
  }

  redirect(ROUTES.interview(interviewId));
}
