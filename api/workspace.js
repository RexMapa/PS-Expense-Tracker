import { configured, validPassword, authenticated, sessionCookie, clearCookie } from '../lib/auth.js';
import { categories, validId, validAmount, validateExpense, validateIncome } from '../lib/validation.js';
import { databaseFailure } from '../lib/database-errors.js';

export function createHandler({ env = process.env, getDatabase, readState } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, value) => res.status(status).json(value);
    if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(405, { error: 'Method not allowed.' }); }
    if (!configured(env)) return send(503, { error: 'Set APP_PASSWORD (16+ characters) and SESSION_SECRET (32+ characters) in your deployment settings.' });
    const secure = env.VERCEL === '1' || env.NODE_ENV === 'production';
    try {
      if (req.method === 'POST') {
        const origin = req.headers.origin;
        if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && new URL(origin).host !== req.headers.host)) return send(403, { error: 'Request origin is not allowed.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected JSON.' });
        if (Number(req.headers['content-length']) > 8192) return send(413, { error: 'Request is too large.' });
        if (typeof req.body === 'string') { if (req.body.length > 8192) return send(413, { error: 'Request is too large.' }); try { req.body = JSON.parse(req.body); } catch { return send(400, { error: 'Invalid JSON.' }); } }
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return send(400, { error: 'Invalid request.' });
        if (req.body.action === 'login') {
          if (!validPassword(req.body.password, env)) return send(401, { error: 'Incorrect workspace password.' });
          res.setHeader('Set-Cookie', sessionCookie(env, secure));
          return send(200, { ok: true });
        }
      }
      if (!authenticated(req, env)) return send(401, { error: 'Sign in to your expense workspace.' });
      if (req.method === 'POST' && req.body.action === 'logout') { res.setHeader('Set-Cookie', clearCookie(secure)); return send(200, { ok: true }); }
      const sql = await getDatabase();
      if (req.method === 'POST') {
        const { action } = req.body;
        if (action === 'saveExpense') {
          const e = req.body.expense;
          if (!validateExpense(e)) return send(400, { error: 'Check the expense fields, date and amount (up to two decimal places).' });
          await sql.query(`INSERT INTO expenses (id, description, amount, date, category, status, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description, amount=EXCLUDED.amount, date=EXCLUDED.date, category=EXCLUDED.category, status=EXCLUDED.status, notes=EXCLUDED.notes, updated_at=now()`,
          [e.id, e.description.trim(), e.amount, e.date, e.category, e.status, e.notes]);
        } else if (action === 'deleteExpense') {
          if (!validId(req.body.id)) return send(400, { error: 'Invalid expense ID.' });
          await sql.query('DELETE FROM expenses WHERE id=$1', [req.body.id]);
        } else if (action === 'saveIncome') {
          const e = req.body.income;
          if (!validateIncome(e)) return send(400, { error: 'Check the income source, date and peso amount (up to two decimal places).' });
          await sql.query(`INSERT INTO income (id, description, source, amount, date, category, status, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description, source=EXCLUDED.source, amount=EXCLUDED.amount, date=EXCLUDED.date, category=EXCLUDED.category, status=EXCLUDED.status, notes=EXCLUDED.notes, updated_at=now()`,
          [e.id, e.description.trim(), e.source.trim(), e.amount, e.date, e.category, e.status, e.notes]);
        } else if (action === 'deleteIncome') {
          if (!validId(req.body.id)) return send(400, { error: 'Invalid income ID.' });
          await sql.query('DELETE FROM income WHERE id=$1', [req.body.id]);
        } else if (action === 'saveBudget') {
          if (!categories.includes(req.body.category) || !validAmount(req.body.amount, true)) return send(400, { error: 'Enter a valid budget with up to two decimal places.' });
          await sql.query('INSERT INTO budgets (category, amount) VALUES ($1,$2) ON CONFLICT (category) DO UPDATE SET amount=EXCLUDED.amount, updated_at=now()', [req.body.category, req.body.amount]);
        } else return send(400, { error: 'Unknown action.' });
      }
      return send(200, await readState(sql));
    } catch (error) {
      const failure = databaseFailure(error);
      // Only a known diagnostic code is logged. Never log credentials or raw SQL errors.
      console.error('[PrimeSphere database]', failure.code);
      return send(503, failure);
    }
  };
}
export default createHandler({
  getDatabase: async () => (await import('../lib/database.js')).readyDatabase(),
  readState: async sql => (await import('../lib/database.js')).readState(sql)
});
