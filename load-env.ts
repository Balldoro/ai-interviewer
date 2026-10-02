import { loadEnvConfig } from '@next/env';

// For tools that run outside Next.js (e.g. drizzle-kit): loads .env* files with the same
// precedence Next.js uses. Import this before anything that reads `env`.
loadEnvConfig(process.cwd());
