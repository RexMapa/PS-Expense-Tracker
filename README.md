# PrimeSphere Expense Tracker

An expense tracker matching the PrimeSphere portal. The rail has no PS caption and the brand subtitle is EXPENSE TRACKER.

Expenses and recurring category budgets are stored in **Neon Postgres** through **Vercel Functions**. This is one shared workspace protected by a workspace password; everyone with that password sees the same records. There are no individual user accounts. Database credentials never go to the browser.

## Deploy from a repository to Vercel

1. Create a Neon project and copy its connection string from the Connect dialog. Use the pooled connection string with TLS enabled.
2. In Neon SQL Editor, run `db/schema.sql`. It creates both tables and can safely be run again.
3. Create a private GitHub repository and upload **the contents of this folder** at its root, including `dist`, `api`, `lib`, `db`, `scripts`, `package.json`, `pnpm-lock.yaml` and `vercel.json`. Exclude `.env.local`, `.git`, `.openai`, `.dependency-store` and `node_modules`.
4. In Vercel, import the repository. Framework preset: **Other**. The included configuration sets build command `npm run build` and output directory `dist`. If using a larger repository, set Root Directory to `expense-tracker`.
5. Add these environment variables in Vercel before deployment:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon PostgreSQL connection string |
   | `APP_PASSWORD` | A unique random workspace password, at least 16 characters |
   | `SESSION_SECRET` | A random secret, at least 32 characters |

   Generate a secret locally: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never commit secrets or prefix them with `PUBLIC`.

6. Deploy, open the Vercel URL, and sign in. Add an expense and reload to verify persistence. Confirm the record in Neon SQL Editor. Future repository pushes redeploy the app.

Use a separate Neon branch/database for preview deployments, or set variables only for Production, to avoid changing production data from previews. Rotating APP_PASSWORD or SESSION_SECRET invalidates sessions; redeploy after environment changes.

## Local development

Requires Node.js 22 or later. Run `npm install`, copy `.env.example` to `.env.local` and fill in the values. Then:

```sh
npm run db:setup
npm run dev
```

Open `http://127.0.0.1:4173`. Serve the HTML with the API; opening index.html directly cannot access Neon.

## Checks

```sh
npm run build
npm test
```

Tests cover authentication, expiry, validation, authorization, cross-origin rejection, parameterized writes and database failures using a simulated database. A live Neon connection is required for full database verification.

The connection uses the official [Neon serverless driver](https://github.com/neondatabase/serverless). Deployment follows [Vercel's Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js) and [project configuration](https://vercel.com/docs/project-configuration/vercel-json) conventions.

## Existing records and backups

The browser updates records only after the server confirms a successful save. CSV exports include the current month and filters. Records from the earlier browser-only version are not automatically migrated: export those first, keep the CSV as a backup, and re-enter them as needed.
