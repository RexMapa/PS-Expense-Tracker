import { schemaStatements } from './schema.js';

const initializations = new WeakMap();

export function ensureSchema(sql) {
  if (!initializations.has(sql)) {
    const promise = (async () => {
      const [tables] = await sql.query("SELECT to_regclass('public.expenses') AS expenses, to_regclass('public.budgets') AS budgets, to_regclass('public.income') AS income");
      if (tables?.expenses && tables?.budgets && tables?.income) return;
      // Serialize first-run setup across serverless instances, in one transaction.
      await sql.transaction([
        sql.query('SELECT pg_advisory_xact_lock(734821906)'),
        ...schemaStatements.map(statement => sql.query(statement))
      ]);
    })();
    initializations.set(sql, promise);
    // An unavailable database must not poison subsequent connection retries.
    promise.catch(() => { initializations.delete(sql); });
  }
  return initializations.get(sql);
}
