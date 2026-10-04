import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

// Vercel sets VERCEL=1 at build and runtime. There the database is Supabase, so SSL with
// certificate verification is mandatory; locally the CA is optional.
const isVercel = Boolean(process.env.VERCEL);

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    // PEM contents (not a path) of the Supabase CA, from Database Settings → SSL Configuration.
    DATABASE_CA_CERT: isVercel
      ? z.string().includes('BEGIN CERTIFICATE', { message: 'Must be a PEM certificate' })
      : z.string().optional(),
    // Speech-to-text for Answers, from ElevenLabs → Developers → API Keys.
    ELEVENLABS_API_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  emptyStringAsUndefined: true,
});
