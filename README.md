# PrimeSphere Expense Tracker

An expense tracker matching the PrimeSphere portal. The rail has no PS caption and the brand subtitle is EXPENSE TRACKER.

Expenses, recurring category budgets, and income are stored in **Neon Postgres** through **Vercel Functions**. This is one shared workspace protected by a workspace password; everyone with that password sees the same records. There are no individual user accounts. Database credentials never go to the browser.

## Four dashboards, Philippine pesos

- **Overview:** combined income, expense and budget summaries, six-month cash-flow analytics, savings rate and recent activity.
- **Expenses:** monthly totals, paid and pending payments, largest spending category, daily activity, category breakdown and searchable expense records.
- **Budgets:** allocated budget, spending, remaining budget, over-budget category count, budget versus actual charts and editable recurring category limits. Pending expenses count toward budget usage.
- **Income sources:** received and expected income, active sources, cash balance, daily received income, source breakdown and searchable payment records. Each record includes a named source, income type, date and status.

All monetary amounts, forms, charts, tooltips and CSV exports use **Philippine pesos (PHP / ₱)**. Each tab exports its own records for the selected month. Cash balance is received income minus paid expenses. Switching tabs preserves each tab's search and filters.

Existing numeric amounts remain unchanged and are now interpreted as PHP. No exchange-rate conversion is performed. If old records were entered in US dollars, review and correct those amounts before using the peso totals.

### Updating the deployed app

Replace the repository files with this version and redeploy on Vercel. Keep the same environment variables. The first authenticated request automatically adds the income table and index to an existing tracker database without deleting expense or budget records. If the database role cannot create tables, run the updated `db/schema.sql` in Neon SQL Editor as the owner.

## Deploy from a repository to Vercel

1. Create a Neon project and copy its connection string from the Connect dialog. Use the pooled connection string with TLS enabled.
2. The app now creates missing tables automatically on the first authenticated connection. If your database role cannot create tables, run `db/schema.sql` once in Neon SQL Editor as the database owner, selecting the same branch and database used by the connection string. Existing tables and records are preserved.
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

### Connection errors

After adding or changing Vercel environment variables, create a new Production deployment; an existing deployment retains its old values. Variables marked Production do not apply to Preview deployments. Copy only the `postgresql://...` connection string from Neon Connect, not a `psql` command. Make sure you selected the intended Neon branch, database and role.

The app initializes missing tables on first sign-in. Connection errors identify missing variables, invalid connection string format, rejected database credentials, missing tables, or insufficient permissions when Neon supplies a diagnostic code. The Vercel `/api/workspace` log records a safe diagnostic code without printing the connection string. Share that code for troubleshooting, not your database password.

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

## Income payment schedules

Income records support one-time payments, once a month, twice a month, and every calendar day. Choose a payday number (1–31) for monthly income, two different numbers for twice-monthly income, or a start date for daily income. The amount is per payment, not the combined monthly amount.

For shorter months, a payday past the month's end uses the last day. If two paydays fall on the same adjusted date, that date is counted once. Schedules begin on or after the record's date. Upcoming paydays and the selected month's planned total appear in the Income dashboard, even when the original record was entered in an earlier month.

The schedule is a forecast, not automatic accounting: it does not insert received payments or add projected amounts to cash balance. The record's status applies to the payment on its record date. Record later actual receipts as one-time payments so their amounts appear in received-income analytics without duplicating the recurring schedule.

After updating the repository and redeploying, the first authenticated connection adds the schedule columns to Neon without changing existing amounts. Existing income defaults to one-time. If automatic migration is denied, run the updated `db/schema.sql` in Neon SQL Editor as the owner.

## Weekly income, payment calendars and expense board

Choose **Every week** in the income schedule, then select Monday through Sunday. Weekly paydays start on or after the record's start date and appear in the upcoming-paydays list and calendar. Amounts are per weekly payment.

Every dashboard includes the same **Payment calendar**, linked to the selected month. It shows expense due dates, recorded income payments, and forecast paydays. Switch between all payments, expenses or income; click a day to see full descriptions, statuses and peso amounts. Changing calendar months also updates the dashboard month. A forecast is omitted when a recorded income payment with the same source, date and amount already exists.

Expense records follow the portal's weekly card layout: a period navigator, six-part totals strip and **To save**, **Ready to pay**, **Paid** columns. New expenses default to To save. Save (or Save all) moves drafts to Ready to pay; Mark paid updates their recorded status; Undo returns them to Ready to pay. These buttons update the tracker only; they do not send payments. The record's date is its due date, which appears in the calendar. Existing Pending expenses appear under Ready to pay, and existing Paid expenses remain Paid.

The History view lists paid expenses for the selected month. Weekly exports include the displayed week and active filters. Details, editing, deletion and per-card CSV downloads are available on each card. The first authenticated connection adds expense-stage and weekly-weekday columns and updates the schedule constraint automatically. Run the updated schema as the Neon owner if your app role lacks migration permissions.
