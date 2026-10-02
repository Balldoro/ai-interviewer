import type { ConnectionOptions } from 'node:tls';

import { env } from '../env';

export type DatabaseConfig = { url: URL; ssl?: ConnectionOptions };

const SSL_URL_PARAMS = ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat'];

// Shared by the app and drizzle-kit.
// Supabase signs its Postgres certificates with its own CA, so verifying them requires that CA.
// When DATABASE_CA_CERT is set, SSL params are stripped from the URL because node-postgres
// lets a URL `sslmode` override the `ssl` option (which would drop the CA).
export function getDatabaseConfig(): DatabaseConfig {
  const url = new URL(env.DATABASE_URL);
  const ca = env.DATABASE_CA_CERT;
  if (!ca) {
    return { url };
  }

  for (const param of SSL_URL_PARAMS) {
    url.searchParams.delete(param);
  }
  return { url, ssl: { ca, rejectUnauthorized: true } };
}
