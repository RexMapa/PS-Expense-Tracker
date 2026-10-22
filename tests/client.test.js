import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const code=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function browser(fetcher){
  const elements=new Map();const element=s=>{if(!elements.has(s))elements.set(s,{value:'',innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){},open:false,showModal(){this.open=true},close(){this.open=false}});return elements.get(s)};
  const context=vm.createContext({document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){}},fetch:fetcher,Intl,Date,Number,JSON,String,Array,Math,setTimeout:()=>1,clearTimeout(){}});
  vm.runInContext(code,context);return{context,element};
}
test('startup loads server records and enables controls',async()=>{
  const {context,element}=browser(async()=>({ok:true,json:async()=>({expenses:[{id:'x',description:'<b>Expense</b>',amount:125.25,date:'2026-10-22',category:'Software',status:'Paid'}],budgets:{}})}));
  await vm.runInContext('load()',context);element('#month').value='2026-10';vm.runInContext('render()',context);
  assert.equal(element('#add').disabled,false);assert.equal(element('#connection').textContent,'Synced');assert.match(element('#rows').innerHTML,/&lt;b&gt;/);assert.equal(element('#donut-total').textContent,'₱125.25');
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
const dashboardState = {
  expenses: [{ id:'expense-1',description:'Software',amount:2000,date:'2026-10-22',category:'Software',status:'Paid',notes:'' },{ id:'expense-2',description:'Pending ads',amount:1000,date:'2026-10-22',category:'Marketing',status:'Pending',notes:'' }],
  budgets: {Software:5000,Marketing:500},
  income: [{id:'income-1',description:'October salary',source:'Employer',amount:20000,date:'2026-10-22',category:'Salary',status:'Received',notes:''},{id:'income-2',description:'Design project',source:'Client',amount:5000,date:'2026-10-23',category:'Freelance',status:'Expected',notes:''}]
};
test('each tab shows its own metrics and dashboard content',async()=>{
  const{context,element}=browser(async()=>({ok:true,json:async()=>dashboardState}));await vm.runInContext('load()',context);element('#month').value='2026-10';vm.runInContext('render()',context);
  assert.equal(element('#title').textContent,'Expenses dashboard');assert.match(element('#stats').innerHTML,/₱3,000.00/);
  vm.runInContext("switchView('income')",context);assert.equal(element('#title').textContent,'Income sources dashboard');assert.match(element('#stats').innerHTML,/₱20,000.00/);assert.match(element('#stats').innerHTML,/₱18,000.00/);assert.match(element('#rows').innerHTML,/Employer/);assert.ok(!element('#rows').innerHTML.includes('Pending ads'));assert.equal(element('#donut-total').textContent,'₱20,000.00');
  vm.runInContext("switchView('budgets')",context);assert.equal(element('#transaction-view').hidden,true);assert.equal(element('#overview').hidden,true);assert.equal(element('#budget-view').hidden,false);assert.match(element('#budget-view').innerHTML,/Budget vs actual spending/);assert.match(element('#budget-view').innerHTML,/₱500.00 over/);assert.match(element('#stats').innerHTML,/₱5,500.00/);
});
test('income search and monthly filtering never mix with expense records',async()=>{
  const{context,element}=browser(async()=>({ok:true,json:async()=>dashboardState}));await vm.runInContext('load()',context);element('#month').value='2026-10';vm.runInContext("switchView('income')",context);element('#search').value='client';vm.runInContext('render()',context);assert.match(element('#rows').innerHTML,/Design project/);assert.ok(!element('#rows').innerHTML.includes('October salary'));element('#month').value='2026-11';vm.runInContext('render()',context);assert.match(element('#rows').innerHTML,/No income found/);
});
test('all three exports label Philippine pesos and export the current tab',async()=>{
  const{context,element}=browser(async()=>({ok:true,json:async()=>dashboardState}));await vm.runInContext('load()',context);element('#month').value='2026-10';assert.ok(vm.runInContext('exportRows()[0].includes("Amount (PHP)")',context));vm.runInContext("switchView('income')",context);assert.equal(vm.runInContext('exportRows()[1][1]',context),'Client');assert.ok(vm.runInContext('exportRows()[0].includes("Amount (PHP)")',context));vm.runInContext("switchView('budgets')",context);assert.ok(vm.runInContext('exportRows()[0].includes("Budget (PHP)")',context));
  assert.ok(!code.includes('USD'));assert.ok(!readFileSync(new URL('../dist/index.html',import.meta.url),'utf8').includes('USD'));
});
test('rail tabs have separate contextual controls and filters',async()=>{
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  const rail=html.slice(html.indexOf('<aside class="rail">'),html.indexOf('<aside class="sidebar">'));
  for(const tab of ['expenses','budgets','income'])assert.ok(rail.includes(`data-view="${tab}"`));
  const{context,element}=browser(async()=>({ok:true,json:async()=>dashboardState}));await vm.runInContext('load()',context);element('#month').value='2026-10';vm.runInContext('render()',context);
  assert.match(element('#context-nav').innerHTML,/EXPENSE CATEGORIES/);vm.runInContext("contextAction({dataset:{contextStatus:'Pending'}})",context);assert.match(element('#rows').innerHTML,/Pending ads/);assert.ok(!element('#rows').innerHTML.includes('>Software<'));
  vm.runInContext("switchView('income')",context);assert.match(element('#context-nav').innerHTML,/INCOME TYPES/);assert.ok(!element('#context-nav').innerHTML.includes('Software'));vm.runInContext("contextAction({dataset:{contextCategory:'Salary'}})",context);assert.match(element('#rows').innerHTML,/October salary/);assert.ok(!element('#rows').innerHTML.includes('Design project'));
  vm.runInContext("switchView('budgets')",context);assert.match(element('#context-nav').innerHTML,/CATEGORY LIMITS/);assert.ok(!element('#context-nav').innerHTML.includes('Expected'));
});
test('overview combines all dashboards and separates cash totals from pending records',async()=>{
  const{context,element}=browser(async()=>({ok:true,json:async()=>dashboardState}));await vm.runInContext('load()',context);element('#month').value='2026-10';vm.runInContext("switchView('summary')",context);
  assert.equal(element('#title').textContent,'Financial overview');assert.equal(element('#summary-view').hidden,false);assert.equal(element('#transaction-view').hidden,true);assert.equal(element('#budget-view').hidden,true);assert.equal(element('#overview').hidden,true);
  const result=vm.runInContext('summaryAnalytics()',context);assert.equal(result.received,20000);assert.equal(result.paid,2000);assert.equal(result.pending,1000);assert.equal(result.expected,5000);assert.equal(result.net,18000);assert.equal(result.savingsRate,90);assert.equal(result.budget,5500);
  const html=element('#summary-view').innerHTML;for(const label of ['Cash-flow analytics','Budget health & spending','Income sources','Recent financial activity','Open Expenses','Open Budgets','Open Income'])assert.ok(html.includes(label));assert.match(html,/90.0%/);assert.match(html,/₱18,000.00/);assert.match(html,/October salary/);assert.match(html,/Pending ads/);
  assert.equal(vm.runInContext('exportRows()[0][1]',context),'Amount (PHP)');vm.runInContext("switchView('income')",context);assert.equal(element('#summary-view').hidden,true);
});
test('overview six-month trend crosses year boundaries and has safe empty states',async()=>{
  const{context,element}=browser(async()=>({ok:true,json:async()=>({expenses:[],budgets:{},income:[]})}));await vm.runInContext('load()',context);element('#month').value='2026-02';vm.runInContext("switchView('summary')",context);const result=vm.runInContext('summaryAnalytics()',context);assert.equal(result.months[0].key,'2025-09');assert.equal(result.months[5].key,'2026-02');assert.equal(result.savingsRate,null);assert.ok(!element('#summary-view').innerHTML.includes('NaN'));assert.ok(!element('#summary-view').innerHTML.includes('Infinity'));assert.match(element('#summary-view').innerHTML,/No activity this month/);
});
test('overview analytics ignore unrelated table filters and compare the previous month',async()=>{
  const state={...dashboardState,expenses:[...dashboardState.expenses,{id:'prior',description:'Prior expense',amount:1500,date:'2026-09-10',category:'Other',status:'Paid',notes:''}]};const{context,element}=browser(async()=>({ok:true,json:async()=>state}));await vm.runInContext('load()',context);element('#month').value='2026-10';element('#category').value='Software';vm.runInContext("switchView('summary')",context);const result=vm.runInContext('summaryAnalytics()',context);assert.equal(result.total,3000);assert.equal(result.previousExpenses,1500);assert.equal(result.months[4].outgoing,1500);assert.match(element('#summary-view').innerHTML,/\+100.0%/);vm.runInContext("switchView('expenses')",context);assert.equal(element('#category').value,'Software');
});
test('payday calculations handle monthly, twice-monthly, daily and short months',async()=>{
  const{context}=browser(async()=>({ok:true,json:async()=>dashboardState}));await vm.runInContext('load()',context);
  const calculate=(record,month)=>JSON.parse(vm.runInContext(`JSON.stringify(scheduleDates(${JSON.stringify(record)},${JSON.stringify(month)}))`,context));
  const base={date:'2026-01-01',frequency:'monthly',payDay1:31};
  assert.deepEqual(calculate(base,'2026-02'),['2026-02-28']);assert.deepEqual(calculate({...base,date:'2024-01-01'},'2024-02'),['2024-02-29']);
  assert.deepEqual(calculate({...base,frequency:'twice_monthly',payDay1:15,payDay2:30},'2026-02'),['2026-02-15','2026-02-28']);
  assert.deepEqual(calculate({...base,frequency:'twice_monthly',payDay1:30,payDay2:31},'2026-02'),['2026-02-28']);
  assert.deepEqual(calculate({...base,date:'2026-10-22',payDay1:15},'2026-10'),[]);
  const daily=calculate({...base,frequency:'daily',date:'2026-10-22'},'2026-10');assert.equal(daily.length,10);assert.equal(daily[0],'2026-10-22');assert.equal(daily[9],'2026-10-31');
});
test('income schedule forecasts do not increase received cash or actual-income analytics',async()=>{
  const state={...dashboardState,income:[{...dashboardState.income[0],frequency:'twice_monthly',payDay1:15,payDay2:30,date:'2026-10-01',amount:10000}]};
  const{context,element}=browser(async()=>({ok:true,json:async()=>state}));await vm.runInContext('load()',context);element('#month').value='2026-10';vm.runInContext("switchView('income')",context);
  assert.equal(element('#income-schedule-view').hidden,false);assert.match(element('#income-schedule-view').innerHTML,/₱20,000.00/);assert.match(element('#income-schedule-view').innerHTML,/Twice a month/);assert.equal(vm.runInContext('summaryAnalytics().received',context),10000);assert.equal(vm.runInContext('summaryAnalytics().net',context),8000);assert.ok(vm.runInContext('exportRows()[0].includes("Payday 1")',context));vm.runInContext("switchView('summary')",context);assert.equal(element('#income-schedule-view').hidden,true);
});
test('PrimeSphere favicon is linked and contains a valid PNG image',()=>{
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert.match(html,/<link rel="icon" type="image\/png" href="\/favicon.png">/);const png=readFileSync(new URL('../dist/favicon.png',import.meta.url));assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(png.readUInt32BE(16)>0);assert.ok(png.readUInt32BE(20)>0);
});
test('weekly payday generation handles every weekday, starts and month boundaries',async()=>{
  const{context}=browser(async()=>({ok:true,json:async()=>dashboardState}));await vm.runInContext('load()',context);
  const calculate=(record,month)=>JSON.parse(vm.runInContext(`JSON.stringify(scheduleDates(${JSON.stringify(record)},${JSON.stringify(month)}))`,context));
  const record={frequency:'weekly',date:'2026-10-01',payWeekday:1};
  assert.deepEqual(calculate(record,'2026-10'),['2026-10-05','2026-10-12','2026-10-19','2026-10-26']);
  assert.deepEqual(calculate({...record,payWeekday:0,date:'2026-10-15'},'2026-10'),['2026-10-18','2026-10-25']);
  assert.deepEqual(calculate({...record,payWeekday:5,date:'2026-10-31'},'2026-11'),['2026-11-06','2026-11-13','2026-11-20','2026-11-27']);
});
test('all dashboard calendars contain due dates, income receipts and recurring forecasts without duplicates',async()=>{
  const state={...dashboardState,income:[{...dashboardState.income[0],frequency:'weekly',payWeekday:4,date:'2026-10-22'}]};const{context,element}=browser(async()=>({ok:true,json:async()=>state}));await vm.runInContext('load()',context);element('#month').value='2026-10';
  const entries=vm.runInContext("calendarEvents('2026-10')",context);assert.equal(entries.filter(e=>e.kind==='income'&&e.date==='2026-10-22').length,1);assert.equal(entries.find(e=>e.date==='2026-10-29').status,'Scheduled');assert.equal(entries.filter(e=>e.kind==='expense').length,2);
  for(const tab of ['summary','expenses','budgets','income']){vm.runInContext(`switchView('${tab}')`,context);assert.match(element('#finance-calendar').innerHTML,/Payment calendar/);assert.match(element('#finance-calendar').innerHTML,/data-calendar-day="2026-10-22"/);assert.match(element('#finance-calendar').innerHTML,/Pending ads/);}
  vm.runInContext("calendarDay='2026-10-22';renderCalendar()",context);assert.match(element('#finance-calendar').innerHTML,/Expense due/);assert.match(element('#finance-calendar').innerHTML,/Received/);
});
test('expense board follows portal stages and separates paid history',async()=>{
  const state={...dashboardState,expenses:[{...dashboardState.expenses[0],status:'Pending',stage:'draft'},{...dashboardState.expenses[1],stage:'ready'},{...dashboardState.expenses[0],id:'paid',description:'Paid bill',stage:'ready'}]};const{context,element}=browser(async()=>({ok:true,json:async()=>state}));await vm.runInContext('load()',context);element('#month').value='2026-10';vm.runInContext("expenseWeek='2026-10-19';switchView('expenses')",context);
  const board=element('#expense-board-view').innerHTML;for(const text of ['To save','Ready to pay','Paid','Save all 1','Mark paid','Undo','This week'])assert.ok(board.includes(text));assert.equal(element('#transaction-view').hidden,true);assert.equal(vm.runInContext("expenseStage({status:'Paid',stage:'ready'})",context),'paid');
  vm.runInContext("expenseMode='history';render()",context);assert.equal(element('#transaction-view').hidden,false);assert.equal(element('#table-title').textContent,'Paid expense history');assert.match(element('#rows').innerHTML,/Paid bill/);assert.ok(!element('#rows').innerHTML.includes('Pending ads'));
});
test('expense stage buttons are enabled again after a save completes',async()=>{
  const state={...dashboardState,expenses:[{...dashboardState.expenses[1],stage:'ready'}]};const{context,element}=browser(async()=>({ok:true,json:async()=>state}));await vm.runInContext('load()',context);element('#month').value='2026-10';vm.runInContext("expenseWeek='2026-10-19';switchView('expenses')",context);
  await vm.runInContext("mutate('setExpenseStage',{ids:['expense-2'],stage:'ready'})",context);const board=element('#expense-board-view').innerHTML;assert.match(board,/Mark paid/);assert.ok(!board.includes('disabled'));assert.equal(vm.runInContext('busy',context),false);
});
