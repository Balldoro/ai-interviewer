import './load-env';

import { defineConfig } from 'drizzle-kit';

import { getDatabaseConfig } from './db/config';

const { url, ssl } = getDatabaseConfig();

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './drizzle',
  // drizzle-kit only accepts custom SSL options with discrete credentials, not a URL.
  dbCredentials: ssl
    ? {
        host: url.hostname,
        port: Number(url.port || 5432),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl,
      }
    : { url: url.toString() },
});
