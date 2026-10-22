import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const code=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function browser(fetcher){
  const elements=new Map();const element=s=>{if(!elements.has(s))elements.set(s,{value:'',innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},open:false,showModal(){this.open=true},close(){this.open=false}});return elements.get(s)};
  const context=vm.createContext({document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){}},fetch:fetcher,Intl,Date,Number,JSON,String,Array,Math,setTimeout:()=>1,clearTimeout(){}});
  vm.runInContext(code,context);return{context,element};
}
test('startup loads server records and enables controls',async()=>{
  const {context,element}=browser(async()=>({ok:true,json:async()=>({expenses:[{id:'x',description:'<b>Expense</b>',amount:125.25,date:'2026-10-22',category:'Software',status:'Paid'}],budgets:{}})}));
  await vm.runInContext('load()',context);element('#month').value='2026-10';vm.runInContext('render()',context);
  assert.equal(element('#add').disabled,false);assert.equal(element('#connection').textContent,'Neon connected');assert.match(element('#rows').innerHTML,/&lt;b&gt;/);assert.equal(element('#donut-total').textContent,'$125.25');
});
test('expired session opens sign-in and blocks writes',async()=>{
  const {context,element}=browser(async()=>({ok:false,status:401,json:async()=>({error:'Sign in'})}));await vm.runInContext('load()',context);assert.equal(element('#login').open,true);assert.equal(element('#add').disabled,true);assert.equal(typeof element('#login-form').onsubmit,'function');
});
test('failed saves preserve the displayed state',async()=>{
  let fail=false;const{context,element}=browser(async()=>fail?{ok:false,status:503,json:async()=>({error:'Database unavailable'})}:{ok:true,json:async()=>({expenses:[],budgets:{}})});await vm.runInContext('load()',context);fail=true;assert.equal(await vm.runInContext("mutate('saveBudget',{category:'Software',amount:500})",context),false);assert.equal(vm.runInContext('Object.keys(budgets).length',context),0);assert.equal(element('#toast').textContent,'Database unavailable');
});
test('branding removes PS caption and changes the subtitle',()=>{
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert.match(html,/EXPENSE TRACKER/);assert.ok(!html.includes('BUSINESS PORTAL'));assert.ok(!html.includes('>PS<'));
});
