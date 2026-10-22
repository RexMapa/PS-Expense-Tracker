import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ensureSchema } from '../lib/schema-init.js';
import { schemaStatements } from '../lib/schema.js';
import { connectionString } from '../lib/database.js';
import { databaseFailure } from '../lib/database-errors.js';

test('bundled schema matches manual SQL and preserves existing records', () => {
  const manual = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8').split(';').map(s => s.trim()).filter(Boolean);
  assert.deepEqual(schemaStatements, manual);
  assert.ok(schemaStatements.every(s => /^(CREATE (TABLE|INDEX) IF NOT EXISTS|ALTER TABLE (income|expenses) ADD COLUMN IF NOT EXISTS|ALTER TABLE income DROP CONSTRAINT IF EXISTS income_frequency_check$|ALTER TABLE income ADD CONSTRAINT income_frequency_check CHECK)/.test(s)));
});

test('first connection creates missing tables once using an advisory lock', async () => {
  const calls = [], transactions = [];
  const sql = {
    query(statement) { calls.push(statement); return statement.startsWith('SELECT to_regclass') ? Promise.resolve([{ expenses: null, budgets: null }]) : { statement }; },
    async transaction(statements) { transactions.push(statements); }
  };
  await Promise.all([ensureSchema(sql), ensureSchema(sql)]);
  await ensureSchema(sql);
  assert.equal(calls.filter(s => s.startsWith('SELECT to_regclass')).length, 1);
  assert.equal(transactions.length, 1);
  assert.match(transactions[0][0].statement, /pg_advisory_xact_lock/);
  assert.equal(transactions[0].length, schemaStatements.length + 1);
});

test('existing tracker tables do not require schema creation permissions', async () => {
  let checks = 0;
  const sql = { async query() { checks++; return [{ expenses: 'expenses', budgets: 'budgets', income: 'income', schedule_ready: true }]; }, async transaction() { assert.fail('Existing tables must not trigger DDL'); } };
  await ensureSchema(sql); await ensureSchema(sql); assert.equal(checks, 1);
});

test('failed initial setup can be retried after the database recovers', async () => {
  let tries = 0;
  const sql = { async query() { if (++tries === 1) throw new Error('Temporary outage'); return [{ expenses: 'expenses', budgets: 'budgets', income: 'income', schedule_ready: true }]; } };
  await assert.rejects(ensureSchema(sql));
  await ensureSchema(sql); assert.equal(tries, 2);
});
test('upgrading an existing database creates the missing income table',async()=>{
  let statements;
  const sql={query(statement){return statement.startsWith('SELECT to_regclass')?Promise.resolve([{expenses:'expenses',budgets:'budgets',income:null}]):{statement}},async transaction(items){statements=items}};
  await ensureSchema(sql);assert.ok(statements.some(item=>item.statement.startsWith('CREATE TABLE IF NOT EXISTS income')));
});
test('existing income tables receive non-destructive schedule columns automatically',async()=>{
  let statements;const sql={query(statement){return statement.startsWith('SELECT to_regclass')?Promise.resolve([{expenses:'expenses',budgets:'budgets',income:'income',schedule_ready:false}]):{statement}},async transaction(items){statements=items}};
  await ensureSchema(sql);for(const column of ['frequency','pay_day_1','pay_day_2'])assert.ok(statements.some(item=>item.statement.startsWith('ALTER TABLE income ADD COLUMN IF NOT EXISTS '+column)));
});
test('income stage migration preserves existing records and defaults to ready',()=>{
  assert.ok(schemaStatements.some(s=>s.startsWith("ALTER TABLE income ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'ready'")));
});

test('connection string accepts copied quotes and whitespace but rejects shell commands', () => {
  const url = 'postgresql://user:password@db.example/database?sslmode=require';
  assert.equal(connectionString(`  "${url}"  `), url);
  assert.throws(() => connectionString(`psql '${url}'`), e => e.code === 'DATABASE_URL_INVALID');
  assert.throws(() => connectionString(''), e => e.code === 'DATABASE_URL_MISSING');
  assert.throws(() => connectionString('https://db.example/database'), e => e.code === 'DATABASE_URL_INVALID');
});

test('database errors give actionable diagnostics without exposing raw error details', () => {
  const denied = databaseFailure({ code: '42501', message: 'secret connection string' });
  assert.match(denied.error, /SQL Editor/);
  assert.equal(denied.code, '42501');
  const generic = databaseFailure(new Error('postgresql://user:private@db.example/database'));
  assert.equal(generic.code, 'DATABASE_CONNECTION_FAILED');
  assert.ok(!JSON.stringify(generic).includes('private'));
  assert.match(databaseFailure({ code: '28P01' }).error, /password/);
});
