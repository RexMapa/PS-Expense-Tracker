import { readFile } from 'node:fs/promises';
import { database } from '../lib/database.js';
const sql = database();
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
try {
  await sql.transaction(statements.map(statement => sql.query(statement)));
  console.log('Neon database ready: expenses, budgets and date index created.');
} catch {
  console.error('Database setup failed. Check DATABASE_URL and Neon connectivity.');
  process.exitCode = 1;
}
