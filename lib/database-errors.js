export function databaseFailure(error) {
  const messages = {
    DATABASE_URL_MISSING: 'DATABASE_URL is missing in this deployment. Add it to Vercel Production settings and redeploy.',
    DATABASE_URL_INVALID: 'DATABASE_URL must be the PostgreSQL connection string from Neon, without a psql command. Update it and redeploy.',
    '28P01': 'Neon rejected the database password. Copy a fresh connection string from Neon, update DATABASE_URL, and redeploy.',
    '28000': 'Neon rejected the database login. Check the role in your Neon connection string and redeploy.',
    '3D000': 'The database name in DATABASE_URL does not exist. Select the correct database in Neon Connect and redeploy.',
    '42501': 'The Neon role cannot access or create the tracker tables. Run db/schema.sql as the database owner in Neon SQL Editor for the same branch and database.',
    '42P01': 'The tracker tables are missing. Run db/schema.sql in Neon SQL Editor for the same branch and database as DATABASE_URL.',
    '42703': 'The database has an incompatible table layout. Check expenses, budgets and income against db/schema.sql; existing records have not been changed.'
  };
  const code = Object.hasOwn(messages, error?.code) ? error.code : 'DATABASE_CONNECTION_FAILED';
  return {
    code,
    error: messages[code] || 'Cannot reach Neon. Check that the project is active and DATABASE_URL is current, then redeploy in Vercel. If it continues, inspect the /api/workspace function log.'
  };
}
