This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database

Postgres via [Drizzle ORM](https://orm.drizzle.team) and `node-postgres`. Locally it runs in Docker; in production it's [Supabase](https://supabase.com) (both Postgres 17). Only env vars change between them.

```bash
cp .env.example .env.local   # points at the local Docker database
pnpm db:up                   # start Postgres (docker compose) and wait until healthy
pnpm dev
curl localhost:3000/api/health
```

| Script             | What it does                                                |
| ------------------ | ----------------------------------------------------------- |
| `pnpm db:up`       | Start local Postgres                                        |
| `pnpm db:down`     | Stop it (data persists in the `postgres-data` volume)       |
| `pnpm db:generate` | Generate SQL migrations from `db/schema.ts` into `drizzle/` |
| `pnpm db:migrate`  | Apply pending migrations to `DATABASE_URL`                  |
| `pnpm db:push`     | Push schema directly without migrations (prototyping)       |
| `pnpm db:studio`   | Open Drizzle Studio                                         |

### Environment variables

Env vars are declared and validated in `env.ts` ([T3 Env](https://env.t3.gg) + Zod). `next dev`, `next build` and drizzle-kit fail immediately with a list of what's missing or invalid. Read them through `env` from `@/env`, not `process.env`.

### Supabase (Vercel)

Set these in the Vercel project:

- `DATABASE_URL`: the Supavisor **transaction** pooler string (port `6543`) from Project → Connect. Leave out `sslmode`.
- `DATABASE_CA_CERT`: the PEM contents of the CA certificate from Database Settings → SSL Configuration. When set, connections use SSL and verify Supabase's certificate.

To run migrations against Supabase from your machine, use the **session** pooler string (port `5432`) with the same `DATABASE_CA_CERT`.

## Sign-in

Users sign in with GitHub or Google through Supabase Auth, locally too. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from Project Settings → API Keys in `.env.local` and in Vercel.

In the Supabase dashboard:

- Authentication → Sign In / Providers: enable GitHub and Google with each provider's OAuth client ID and secret. Both OAuth apps use `https://<project-ref>.supabase.co/auth/v1/callback` as their callback URL.
- Authentication → URL Configuration: set the Site URL to production and add `http://localhost:3000/**` and `https://*-<vercel-team-slug>.vercel.app/**` to the redirect allow list. The wildcard covers every preview deployment; the app always asks to return to the URL the User started on.

Server code gets the signed-in User through `getUserId()` (or `requireUserId()`, which sends a signed-out visitor to `/sign-in`) from `modules/auth/lib/user.ts`.

Sign-in uses the hosted Supabase project even when the data is in Docker. Each sign-in adds the User to the `users` table, which other tables reference instead of `auth.users`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
