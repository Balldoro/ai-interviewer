// The one place that knows where logs go. Runs on the server, the client and the edge, so a
// switch to Sentry or PostHog error tracking only changes this file.
// Keep messages fixed and put the details in `context`, so the same failure groups as one issue.
type LogContext = Record<string, unknown>;

export const logger = {
  info(message: string, context?: LogContext) {
    console.info(message, context ?? '');
  },
  warn(message: string, context?: LogContext) {
    console.warn(message, context ?? '');
  },
  error(message: string, error?: unknown, context?: LogContext) {
    console.error(message, error, context ?? '');
  },
};
