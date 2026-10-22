import { database } from '../lib/database.js';
import { schemaStatements } from '../lib/schema.js';
const sql = database();
try {
  await sql.transaction([sql.query('SELECT pg_advisory_xact_lock(734821906)'), ...schemaStatements.map(statement => sql.query(statement))]);
  console.log('Neon database ready: expenses, budgets, income and date indexes created.');
} catch {
  console.error('Database setup failed. Check DATABASE_URL and Neon connectivity.');
  process.exitCode = 1;
}
