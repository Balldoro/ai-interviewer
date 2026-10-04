export const ROUTES = {
  setup: '/',
  signIn: '/sign-in',
  authCallback: '/auth/callback',
  interview: (interviewId: string) => `/interviews/${interviewId}`,
} as const;
