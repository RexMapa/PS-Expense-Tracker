import { neon } from '@neondatabase/serverless';
let client;
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return client ||= neon(process.env.DATABASE_URL);
}
export async function readState(sql) {
  const [expenses, budgets] = await Promise.all([
    sql.query("SELECT id, description, amount::float8 AS amount, to_char(date, 'YYYY-MM-DD') AS date, category, status, notes FROM expenses ORDER BY date DESC, created_at DESC"),
    sql.query('SELECT category, amount::float8 AS amount FROM budgets')
  ]);
  return { expenses, budgets: Object.fromEntries(budgets.map(row => [row.category, row.amount])) };
}
