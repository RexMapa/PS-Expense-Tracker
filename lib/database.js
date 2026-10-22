import { neon } from '@neondatabase/serverless';
import { ensureSchema } from './schema-init.js';
let client;
export function connectionString(raw) {
  if (!raw || !raw.trim()) throw Object.assign(new Error('Missing connection string'), { code: 'DATABASE_URL_MISSING' });
  let value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1).trim();
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2) throw new Error();
  } catch {
    throw Object.assign(new Error('Invalid connection string'), { code: 'DATABASE_URL_INVALID' });
  }
  return value;
}
export function database() {
  return client ||= neon(connectionString(process.env.DATABASE_URL));
}
export async function readyDatabase() {
  const sql = database();
  await ensureSchema(sql);
  return sql;
}
export async function readState(sql) {
  const [expenses, budgets, income] = await Promise.all([
    sql.query("SELECT id, description, amount::float8 AS amount, to_char(date, 'YYYY-MM-DD') AS date, category, status, notes, stage FROM expenses ORDER BY date DESC, created_at DESC"),
    sql.query('SELECT category, amount::float8 AS amount FROM budgets'),
    sql.query('SELECT id, description, source, amount::float8 AS amount, to_char(date, \'YYYY-MM-DD\') AS date, category, status, notes, frequency, pay_day_1 AS "payDay1", pay_day_2 AS "payDay2", pay_weekday AS "payWeekday", stage FROM income ORDER BY date DESC, created_at DESC')
  ]);
  return { expenses, income, budgets: Object.fromEntries(budgets.map(row => [row.category, row.amount])) };
}
