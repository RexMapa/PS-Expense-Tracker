import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionCookie, authenticated, validPassword } from '../lib/auth.js';
import { validateExpense } from '../lib/validation.js';
import { createHandler } from '../api/workspace.js';
const env = { APP_PASSWORD: 'test-password-only-123456', SESSION_SECRET: 'test-session-secret-only-1234567890', VERCEL: '1' };
const expense = { id: '54e5f7b8-0000-4000-8000-123456789abc', description: "Supplier's software", amount: 125.25, date: '2026-10-22', category: 'Software', status: 'Paid', notes: '' };
const cookie = () => sessionCookie(env).split(';')[0];
function response() { return { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.code=n; return this; }, json(v) { this.body=v; return this; } }; }
function request(body, signedIn = true) { return { method: body ? 'POST' : 'GET', headers: { host: 'tracker.example', origin: 'https://tracker.example', 'content-type': 'application/json', ...(signedIn ? { cookie: cookie() } : {}) }, body }; }
function setup() {
  const calls=[];
  const handler=createHandler({env,getDatabase:async()=>({query:async(...args)=>{calls.push(args);return [];}}),readState:async()=>({expenses:[expense],budgets:{Software:500}})});
  return { handler,calls };
}
test('sessions reject tampering, expiration and password rotation',()=>{
  const now=Date.now();const token=sessionCookie(env,true,now).split(';')[0];
  assert.ok(authenticated({headers:{cookie:token}},env,now));
  assert.ok(!authenticated({headers:{cookie:token+'bad'}},env,now));
  assert.ok(!authenticated({headers:{cookie:token}},env,now+8*86400000));
  assert.ok(!authenticated({headers:{cookie:token}},{...env,APP_PASSWORD:'changed-password-123'},now));
  assert.ok(validPassword(env.APP_PASSWORD,env));assert.ok(!validPassword('wrong',env));
});
test('expense validation rejects impossible dates and unsafe amounts',()=>{
  assert.ok(validateExpense(expense));
  for(const patch of [{date:'2026-02-30'},{amount:-1},{amount:NaN},{amount:1.001},{description:' '},{category:'Unknown'},{id:'not-uuid'},{notes:'x'.repeat(501)}]) assert.ok(!validateExpense({...expense,...patch}));
});
test('API denies unauthenticated reads and sets no-store',async()=>{
  const {handler,calls}=setup(),res=response();await handler(request(null,false),res);
  assert.equal(res.code,401);assert.equal(calls.length,0);assert.equal(res.headers['Cache-Control'],'no-store');
});
test('login issues a secure HttpOnly session and logout clears it',async()=>{
  const {handler}=setup(),res=response();await handler(request({action:'login',password:env.APP_PASSWORD},false),res);
  assert.equal(res.code,200);assert.match(res.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);assert.match(res.headers['Set-Cookie'],/Secure/);
  const out=response();await handler(request({action:'logout'}),out);assert.equal(out.code,200);assert.match(out.headers['Set-Cookie'],/Max-Age=0/);
  const bad=response();await handler(request({action:'login',password:'wrong'},false),bad);assert.equal(bad.code,401);
});
test('authenticated reads return expense and budget state',async()=>{
  const {handler}=setup(),res=response();await handler(request(),res);assert.equal(res.code,200);assert.equal(res.body.expenses[0].amount,125.25);assert.equal(res.body.budgets.Software,500);
});
test('cross-origin writes are rejected before touching the database',async()=>{
  const {handler,calls}=setup(),res=response(),req=request({action:'saveExpense',expense});req.headers.origin='https://untrusted.example';await handler(req,res);assert.equal(res.code,403);assert.equal(calls.length,0);
});
test('expense writes use placeholders, never interpolate descriptions',async()=>{
  const {handler,calls}=setup(),res=response();const e={...expense,description:"'); DROP TABLE expenses; --"};await handler(request({action:'saveExpense',expense:e}),res);assert.equal(res.code,200);assert.match(calls[0][0],/VALUES \(\$1,\$2/);assert.ok(!calls[0][0].includes(e.description));assert.equal(calls[0][1][1],e.description);
});
test('delete and budget actions validate inputs and use parameters',async()=>{
  const {handler,calls}=setup();const del=response();await handler(request({action:'deleteExpense',id:expense.id}),del);assert.equal(del.code,200);assert.deepEqual(calls[0][1],[expense.id]);
  const budget=response();await handler(request({action:'saveBudget',category:'Software',amount:100}),budget);assert.equal(budget.code,200);assert.deepEqual(calls[1][1],['Software',100]);
  for(const body of [{action:'saveExpense',expense:{...expense,amount:-1}},{action:'deleteExpense',id:'invalid'},{action:'saveBudget',category:'Other',amount:-1}]){const res=response();await handler(request(body),res);assert.equal(res.code,400)}assert.equal(calls.length,2);
});
test('configuration and database failures do not leak secrets',async()=>{
  const unconfigured=createHandler({env:{}}),res=response();await unconfigured(request(),res);assert.equal(res.code,503);
  const broken=createHandler({env,getDatabase:async()=>{throw new Error('postgresql://private:secret@db')}}),bad=response();await broken(request(),bad);assert.equal(bad.code,503);assert.ok(!JSON.stringify(bad.body).includes('private:secret'));
});
