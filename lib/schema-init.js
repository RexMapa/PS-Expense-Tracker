import { schemaStatements } from './schema.js';

const initializations = new WeakMap();

export function ensureSchema(sql) {
  if (!initializations.has(sql)) {
    const promise = (async () => {
      const [tables] = await sql.query("SELECT to_regclass('public.expenses') AS expenses, to_regclass('public.budgets') AS budgets, to_regclass('public.income') AS income, ((SELECT count(*) = 5 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income' AND column_name IN ('frequency','pay_day_1','pay_day_2','pay_weekday','stage')) AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='stage')) AS schedule_ready");
      if (tables?.expenses && tables?.budgets && tables?.income && tables?.schedule_ready) return;
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
