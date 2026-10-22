const $ = selector => document.querySelector(selector);
const cats = ['Software', 'Marketing', 'Travel', 'Office', 'Other'];
const incomeCats = ['Salary', 'Freelance', 'Business', 'Investments', 'Other'];
const colors = ['#1fbef8', '#727cf5', '#46c9ac', '#eab96c', '#8b9dbb'];
const money = n => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = records => records.reduce((total, record) => total + record.amount, 0);
const dateText = date => new Date(date + 'T12:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function addDays(key, count) { const date = new Date(key+'T12:00:00'); date.setDate(date.getDate()+count); return dateKey(date); }
function weekStart(key) { const date = new Date(key+'T12:00:00'); return addDays(key,-((date.getDay()+6)%7)); }
let data = [], income = [], budgets = {}, view = 'expenses', editing = null, editorKind = 'expenses', ready = false, busy = false;
let expenseMode = 'week', expenseWeek = weekStart(today()), calendarDay = today(), calendarKind = 'all';
let incomeMode = 'week', incomeWeek = weekStart(today());
const filters = { expenses: { search: '', category: '', status: '' }, income: { search: '', category: '', status: '' } };
$('#month').value = today().slice(0, 7);

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}
function clearState() { data = []; income = []; budgets = {}; }
async function api(action, payload = {}) {
  const response = await fetch('/api/workspace', {
    method: action ? 'POST' : 'GET', headers: action ? { 'Content-Type': 'application/json' } : {},
    credentials: 'same-origin', body: action ? JSON.stringify({ action, ...payload }) : undefined
  });
  const result = await response.json().catch(() => ({ error: 'Unable to read the server response.' }));
  if (!response.ok) {
    if (response.status === 401) {
      ready = false; clearState(); render(); connection('Sign in required');
      if ($('#editor').open) $('#editor').close();
      if (!$('#login').open) $('#login').showModal();
    }
    throw new Error(result.error || 'Unable to connect. Please try again.');
  }
  return result;
}
function connection(message) {
  $('#connection').textContent = message;
  $('#add').disabled = !ready || busy;
  $('#export').disabled = !ready;
  $('#signout').hidden = !ready;
}
function applyState(state) {
  data = state.expenses || []; income = state.income || []; budgets = state.budgets || {}; render();
}
async function load() {
  ready = false; connection('Connecting…'); $('#load-error').hidden = true;
  try { const state = await api(); ready = true; applyState(state); connection('Synced'); }
  catch (error) {
    connection($('#login').open ? 'Sign in required' : 'Connection unavailable');
    if (!$('#login').open) { $('#load-error span').textContent = error.message; $('#load-error').hidden = false; }
  }
}
async function mutate(action, payload) {
  if (!ready || busy) return false;
  busy = true; $('#add').disabled = true;
  try { const state = await api(action, payload); applyState(state); return true; }
  catch (error) { notify(error.message); return false; }
  finally { busy = false; $('#add').disabled = !ready; render(); }
}
function selected(kind = 'expenses') {
  return (kind === 'income' ? income : data).filter(record => record.date.startsWith($('#month').value));
}
function filtered() {
  const kind = view === 'income' ? 'income' : 'expenses';
  return selected(kind).filter(record => (!$('#category').value || record.category === $('#category').value)
    && matchesPaymentStatus(record, kind === 'income', $('#status').value)
    && `${record.description} ${record.source || ''} ${record.notes || ''}`.toLowerCase().includes($('#search').value.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
}
function setFilters() {
  if (!filters[view]) return;
  const isIncome = view === 'income', options = isIncome ? incomeCats : cats;
  $('#category').innerHTML = '<option value="">All ' + (isIncome ? 'types' : 'categories') + '</option>' + options.map(c => `<option>${c}</option>`).join('');
  $('#status').innerHTML = '<option value="">All statuses</option>' + paymentStages(isIncome).map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
  $('#search').value = filters[view].search;
  $('#category').value = filters[view].category;
  $('#status').value = filters[view].status;
  $('#search').placeholder = isIncome ? 'Search income or sources…' : 'Search expenses…';
  $('#search').setAttribute('aria-label', isIncome ? 'Search income or sources' : 'Search expenses');
  $('#category').setAttribute('aria-label', isIncome ? 'Filter income type' : 'Filter expense category');
}
function switchView(next) {
  if (!['summary', 'expenses', 'budgets', 'income'].includes(next)) return;
  if (filters[view]) filters[view] = { search: $('#search').value, category: $('#category').value, status: $('#status').value };
  view = next; setFilters(); render();
  $('#title').scrollIntoView?.({ behavior: 'auto', block: 'start' });
}
function renderStats(cards) {
  $('#stats').innerHTML = cards.map(([label, value, detail, icon]) => `<article class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon}</span></div><strong>${value}</strong><small>${detail}</small></article>`).join('');
}
function renderActivity(records, breakdown, total, isIncome) {
  const month = $('#month').value, date = new Date(month + '-01T12:00:00');
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const daily = Array.from({ length: days }, (_, i) => sum(records.filter(record => Number(record.date.slice(-2)) === i + 1)));
  const max = Math.max(...daily, 1);
  $('#activity-title').textContent = isIncome ? 'Income activity' : 'Spending activity';
  $('#activity-copy').textContent = isIncome ? 'Received income by day · PHP' : 'Recorded expenses by day · PHP';
  $('#activity-legend').textContent = isIncome ? '● Received' : '● Total spent';
  $('#chart').innerHTML = daily.map((value, i) => `<div class="bar ${isIncome ? 'income-bar' : ''}" style="height:${Math.max(1, value / max * 100)}%;opacity:${value ? 1 : .15}" title="${month}-${String(i + 1).padStart(2, '0')}: ${money(value)}"></div>`).join('');
  $('#last-day').textContent = days;
  $('#breakdown-title').textContent = isIncome ? 'By income source' : 'By category';
  $('#breakdown-copy').textContent = isIncome ? 'Where received income comes from' : 'Where your money goes';
  $('#donut-label').textContent = isIncome ? 'Received income' : 'Total expenses';
  $('#donut-total').textContent = money(total);
  let start = 0;
  const stops = breakdown.map(([label, amount], i) => {
    const end = start + (total ? amount / total * 100 : 0), stop = `${colors[i % colors.length]} ${start}% ${end}%`;
    start = end; return stop;
  });
  $('#donut').style.background = total ? `conic-gradient(${stops.join(',')})` : '#1e304a';
  $('#categories').innerHTML = breakdown.length ? breakdown.map(([label, amount], i) => `<div class="category-row"><i style="background:${colors[i % colors.length]}"></i><span title="${esc(label)}">${esc(label)}</span><b>${money(amount)}</b></div>`).join('') : '<p class="source-empty">No received income this month.</p>';
}
function budgetRows() {
  const expenses = selected();
  return cats.map(category => ({ category, limit: Number(budgets[category]) || 0, spent: sum(expenses.filter(e => e.category === category)) }));
}
function renderBudgets(rows) {
  const max = Math.max(...rows.flatMap(row => [row.limit, row.spent]), 1);
  $('#budget-view').innerHTML = `<div class="charts"><article class="card"><div class="card-head"><div><h2>Budget vs actual spending</h2><p>Compare each monthly limit with recorded expenses</p></div></div><div class="budget-legend"><span>● Allocated</span><span>● Spent</span></div>${rows.map(row => `<div class="comparison"><div><span>${row.category}</span><small>${money(row.spent)} / ${money(row.limit)}</small></div><div class="comparison-track"><i style="width:${row.limit / max * 100}%"></i></div><div class="comparison-track spent"><i class="${row.limit && row.spent > row.limit ? 'over' : ''}" style="width:${row.spent / max * 100}%"></i></div></div>`).join('')}</article><article class="card"><div class="card-head"><div><h2>Budget health</h2><p>Monthly limits repeat each month</p></div></div>${rows.map(row => `<div class="health-row"><span>${row.category}</span><span class="badge ${row.limit && row.spent > row.limit ? 'pending' : ''}">${!row.limit ? 'No budget set' : row.spent > row.limit ? money(row.spent - row.limit) + ' over' : money(row.limit - row.spent) + ' left'}</span></div>`).join('')}<p class="budget-note">All expenses, including pending payments, count toward your budget.</p></article></div><article class="card"><div class="card-head"><div><h2>Manage monthly budgets</h2><p>Enter a category limit in Philippine pesos. Changes save automatically.</p></div></div><div class="budget-grid">${rows.map(row => `<div class="budget-item"><label>${row.category}<span>Monthly limit (₱)</span><input class="budget-edit" type="number" min="0" max="999999999" step="0.01" data-budget="${row.category}" aria-label="${row.category} monthly budget in pesos" value="${row.limit}" ${!ready || busy ? 'disabled' : ''}></label><progress value="${Math.min(row.spent, row.limit)}" max="${row.limit || 1}"></progress><small>${money(row.spent)} spent${row.limit ? ' · ' + Math.round(row.spent / row.limit * 100) + '% used' : ''}</small></div>`).join('')}</div></article>`;
}
function renderTable() {
  const isIncome = view === 'income', rows = isIncome && incomeMode === 'history' ? filtered().filter(r=>r.status === 'Received') : !isIncome && expenseMode === 'history' ? filtered().filter(r=>r.status === 'Paid') : filtered();
  $('#table-title').textContent = isIncome ? 'Received income history' : expenseMode === 'history' ? 'Paid expense history' : 'Expense records';
  $('#table-copy').textContent = isIncome ? 'Track received and expected payments from every source' : 'All your expense records for the selected month';
  $('#record-heading').textContent = isIncome ? 'INCOME / SOURCE' : 'EXPENSE';
  $('#category-heading').textContent = isIncome ? 'TYPE' : 'CATEGORY';
  $('#result-count').textContent = rows.length + ' records';
  $('#rows').innerHTML = rows.length ? rows.map(record => `<tr><td><div class="expense-cell"><span class="expense-icon">${esc(record.description.charAt(0).toUpperCase())}</span><span>${esc(record.description)}${isIncome ? '<small>' + esc(record.source) + '</small><small>' + esc(scheduleLabel(record)) + '</small>' : ''}</span></div></td><td>${esc(record.category)}</td><td>${dateText(record.date)}</td><td><span class="badge ${['Pending', 'Expected'].includes(record.status) ? 'pending' : ''}">${esc(record.status)}</span></td><td class="amount">${money(record.amount)}</td><td><button class="row-action" data-edit="${esc(record.id)}" aria-label="Edit ${esc(record.description)}">Edit</button><button class="row-action" data-delete="${esc(record.id)}" aria-label="Delete ${esc(record.description)}">×</button></td></tr>`).join('') : `<tr><td colspan="6" class="empty">No ${isIncome ? 'income' : 'expenses'} found. ${isIncome ? 'Add an income source or payment' : 'Add an expense'} to get started.</td></tr>`;
  $('#footer-count').textContent = rows.length + ' records · ' + money(sum(rows));
}
function renderSidebar() {
  const isIncome = view === 'income';
  $('#section-title').textContent = { summary: 'Overview', expenses: 'Expenses', budgets: 'Budgets', income: 'Income sources' }[view];
  $('#section-copy').textContent = { summary: 'Your complete financial picture.', expenses: 'Manage your spending.', budgets: 'Plan every peso.', income: 'Track what comes in.' }[view];
  $('#context-nav').setAttribute('aria-label', $('#section-title').textContent + ' controls');
  if (view === 'summary') {
    $('#context-nav').innerHTML = '<div class="context-label">ANALYTICS</div>' + [['trend','Cash-flow trend'],['dashboards','All dashboards'],['budget','Budget health'],['sources','Income sources'],['activity','Recent activity']].map(([key, label]) => `<button data-summary-anchor="${key}"><span class="context-dot"></span><span>${label}</span></button>`).join('');
    return;
  }
  if (view === 'budgets') {
    $('#context-nav').innerHTML = '<button data-budget-home="true" class="active">◷ <span>Monthly dashboard</span></button><div class="context-label">CATEGORY LIMITS</div>' + cats.map(c => `<button data-budget-focus="${c}"><span class="context-dot"></span><span>${c}</span></button>`).join('');
    return;
  }
  const start = isIncome ? incomeWeek : expenseWeek, end = addDays(start,6);
  const records = (isIncome ? income : data).filter(r=>r.date>=start&&r.date<=end), category = $('#category').value, status = $('#status').value;
  const all = !category && !status;
  const statuses = paymentStages(isIncome);
  $('#context-nav').innerHTML = `<button data-context-all="true" class="${all ? 'active' : ''}">≡ <span>All ${isIncome ? 'income' : 'expenses'}</span><em>${records.length}</em></button><div class="context-label">PAYMENT STATUS</div>`
    + statuses.map(([value,label]) => `<button data-context-status="${value}" class="${status === value ? 'active' : ''}"><span class="context-dot"></span><span>${label}</span><em>${records.filter(r => matchesPaymentStatus(r,isIncome,value)).length}</em></button>`).join('')
    + `<div class="context-label">${isIncome ? 'INCOME TYPES' : 'EXPENSE CATEGORIES'}</div>`
    + (isIncome ? incomeCats : cats).map(c => `<button data-context-category="${c}" class="${category === c ? 'active' : ''}"><span class="context-dot"></span><span>${c}</span></button>`).join('');
}
function contextAction(button) {
  if (view === 'budgets') {
    if (button.dataset.budgetFocus) {
      const field = document.querySelector(`[data-budget="${button.dataset.budgetFocus}"]`);
      if (field) { field.scrollIntoView({ behavior: 'smooth', block: 'center' }); field.focus({ preventScroll: true }); }
    } else if (button.dataset.budgetHome) $('#title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  $('#search').value = '';
  if (button.dataset.contextAll) { $('#category').value = ''; $('#status').value = ''; if(view==='income')incomeMode='week';else if(view==='expenses')expenseMode='week'; }
  else if (button.dataset.contextStatus) { $('#category').value = ''; $('#status').value = button.dataset.contextStatus; if(view==='income')incomeMode='week';else if(view==='expenses')expenseMode='week'; }
  else if (button.dataset.contextCategory) { $('#status').value = ''; $('#category').value = button.dataset.contextCategory; }
  render();
}
function render() {
  const expenses = selected(), incomeRecords = selected('income'), total = sum(expenses);
  const pending = sum(expenses.filter(e => e.status === 'Pending'));
  const receivedRecords = incomeRecords.filter(e => e.status === 'Received'), received = sum(receivedRecords);
  const expected = sum(incomeRecords.filter(e => incomeStage(e) === 'ready'));
  const rows = budgetRows(), budget = rows.reduce((s, row) => s + row.limit, 0);
  const labels = { summary: 'Overview', expenses: 'Expenses', budgets: 'Budgets', income: 'Income sources' };
  $('#period-label').textContent = new Date($('#month').value + '-01T12:00:00').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  renderSidebar();
  $('#context-nav').innerHTML += '<div class="context-label">PLANNING</div><button data-open-calendar="true"><span class="context-dot"></span><span>Payment calendar</span></button>';
  $('#title').textContent = view === 'summary' ? 'Financial overview' : labels[view] + ' dashboard'; $('#crumb').textContent = labels[view];
  $('#subtitle').textContent = { summary: 'Income, spending and budgets. One clear picture of every peso.', expenses: 'Understand your spending, one expense at a time.', budgets: 'Give every peso a purpose. Plan your monthly spending.', income: 'Know where your income comes from and what is still expected.' }[view];
  $('#add').hidden = view === 'budgets' || view === 'summary'; $('#add').textContent = view === 'income' ? '＋ Add income' : '＋ Add expense';
  $('#export').textContent = '↓ Export ' + (view === 'budgets' ? 'budgets' : 'CSV');
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === view; button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('#overview').hidden = view === 'budgets' || view === 'summary'; $('#budget-view').hidden = view !== 'budgets'; $('#transaction-view').hidden = view === 'budgets' || view === 'summary';
  $('#summary-view').hidden = view !== 'summary';
  $('#income-schedule-view').hidden = view !== 'income';
  $('#expense-board-view').hidden = view !== 'expenses';
  $('#income-board-view').hidden = view !== 'income';
  if (view === 'summary') {
    renderStats([['Received income', money(received), 'Confirmed payments this month', '↙'], ['Total expenses', money(total), 'Paid and pending expenses', '↗'], ['Cash balance', money(received - (total - pending)), 'Received income less paid expenses', '◈'], ['Budget remaining', budget ? money(budget - total) : 'Not set', 'Monthly budget less all expenses', '◷']]);
    renderSummary();
  } else if (view === 'budgets') {
    renderStats([['Monthly budget', money(budget), 'Recurring category limits', '◈'], ['Spent this month', money(total), 'Paid and pending expenses', '↗'], ['Budget remaining', budget ? money(budget - total) : 'Not set', 'Total budget less all expenses', '◷'], ['Over-budget categories', String(rows.filter(r => r.limit && r.spent > r.limit).length), 'Categories exceeding a set limit', '!']]);
    renderBudgets(rows);
  } else if (view === 'income') {
    renderStats([['Received income', money(received), 'Payments received this month', '↙'], ['Expected income', money(expected), 'Payments still to come', '◷'], ['Active sources', String(new Set(incomeRecords.map(e => e.source.trim().toLowerCase())).size), 'Sources recorded this month', '◈'], ['Cash balance', money(received - (total - pending)), 'Received income less paid expenses', '↗']]);
    const sources = new Map();
    receivedRecords.forEach(e => { const key = e.source.trim().toLowerCase(), previous = sources.get(key); sources.set(key, { label: previous?.label || e.source.trim(), amount: (previous?.amount || 0) + e.amount }); });
    let breakdown = [...sources.values()].sort((a, b) => b.amount - a.amount).map(s => [s.label, s.amount]);
    if (breakdown.length > 5) breakdown = [...breakdown.slice(0, 4), ['Other sources', breakdown.slice(4).reduce((s, r) => s + r[1], 0)]];
    renderActivity(receivedRecords, breakdown, received, true); renderTable(); renderIncomeSchedules(); renderIncomeBoard();
    $('#transaction-view').hidden = incomeMode !== 'history';
  } else {
    renderStats([['Total expenses', money(total), 'Recorded this month', '↗'], ['Paid expenses', money(total - pending), 'Payments completed', '✓'], ['Pending payments', money(pending), 'Payments awaiting completion', '◷'], ['Largest category', total ? cats[cats.map(c => sum(expenses.filter(e => e.category === c))).indexOf(Math.max(...cats.map(c => sum(expenses.filter(e => e.category === c)))))] : '—', total ? money(Math.max(...cats.map(c => sum(expenses.filter(e => e.category === c))))) + ' this month' : 'No spending recorded', '◈']]);
    renderActivity(expenses, cats.map(c => [c, sum(expenses.filter(e => e.category === c))]), total, false); renderTable();
    renderExpenseBoard();
    $('#transaction-view').hidden = expenseMode !== 'history';
  }
  renderCalendar();
}
function expenseStage(record) { return record.status === 'Paid' ? 'paid' : record.stage === 'draft' ? 'draft' : 'ready'; }
function incomeStage(record) { return record.status === 'Received' ? 'received' : record.stage === 'draft' ? 'draft' : 'ready'; }
function paymentStages(isIncome) { return isIncome ? [['draft','To save'],['ready','Ready to receive'],['received','Received']] : [['draft','To save'],['ready','Ready to pay'],['paid','Paid']]; }
function matchesPaymentStatus(record,isIncome,status) { return !status || (['draft','ready','paid','received'].includes(status) ? (isIncome?incomeStage(record):expenseStage(record))===status : record.status===status); }
function expenseBoardRecords() {
  const end = addDays(expenseWeek,6), search = $('#search').value.toLowerCase();
  return data.filter(r=>r.date >= expenseWeek && r.date <= end && (!$('#category').value || r.category === $('#category').value) && matchesPaymentStatus(r,false,$('#status').value) && `${r.description} ${r.notes || ''}`.toLowerCase().includes(search)).sort((a,b)=>a.date.localeCompare(b.date));
}
function expenseCard(r) {
  const stage = expenseStage(r), late = r.status !== 'Paid' && r.date < today();
  return `<article class="expense-pay-card"><div class="pay-card-head"><div><h3>${esc(r.description)}</h3><small>${esc(r.category)} · Due ${dateText(r.date)}</small></div><div><small>Amount</small><strong>${money(r.amount)}</strong></div></div><div class="pay-card-metrics"><div><small>Category</small><b>${esc(r.category)}</b></div><div><small>Due date</small><b>${dateText(r.date)}</b></div><div><small>Status</small><b class="${late?'late-text':''}">${stage === 'draft' ? 'To save' : stage === 'paid' ? 'Paid' : late ? 'Overdue' : 'Ready to pay'}</b></div></div><div class="pay-card-actions"><details><summary>⌄ Details</summary><p>${esc(r.notes || 'No notes added.')}</p><button class="row-action" data-edit="${esc(r.id)}">Edit</button><button class="row-action" data-delete="${esc(r.id)}">Delete</button></details><button class="row-action" data-expense-download="${esc(r.id)}" title="Download expense CSV" aria-label="Download ${esc(r.description)}">↓</button><button class="${stage==='paid'?'':'primary'}" data-expense-stage="${stage==='draft'?'ready':stage==='ready'?'paid':'ready'}" data-expense-id="${esc(r.id)}" ${!ready||busy?'disabled':''}>${stage==='draft'?'▣ Save':stage==='ready'?'✓ Mark paid':'Undo'}</button></div></article>`;
}
function renderExpenseBoard() {
  const records = expenseBoardRecords(), grouped = {draft:records.filter(r=>expenseStage(r)==='draft'),ready:records.filter(r=>expenseStage(r)==='ready'),paid:records.filter(r=>expenseStage(r)==='paid')};
  $('#expense-board-view').innerHTML = `<div class="expense-board-heading"><div><h2>Expense records</h2><p>Review, save and track payments. Dates below show when each expense is due.</p></div><div class="record-tabs"><button data-expense-mode="week" class="${expenseMode==='week'?'active':''}">Weekly expenses</button><button data-expense-mode="history" class="${expenseMode==='history'?'active':''}">History</button></div></div>${expenseMode==='week'?`<div class="expense-week-toolbar"><button data-expense-week="-1" aria-label="Previous expense week">‹</button><b>${dateText(expenseWeek)} – ${dateText(addDays(expenseWeek,6))}</b><button data-expense-week="1" aria-label="Next expense week">›</button><button data-expense-today="true">This week</button><button data-board-export="true">↓ Export CSV</button></div><div class="payroll-summary">${[['Total expenses',money(sum(records))],['To save',money(sum(grouped.draft))],['Ready to pay',money(sum(grouped.ready))],['Paid',money(sum(grouped.paid))],['Awaiting payment',String(grouped.draft.length+grouped.ready.length)],['Paid records',`${grouped.paid.length} of ${records.length}`]].map(([label,value],i)=>`<div><small>${label}</small><strong class="${i===0?'accent-text':''}">${value}</strong></div>`).join('')}</div><div class="expense-board-columns">${[['draft','To save','Review each expense, then save it.','No expenses to save.'],['ready','Ready to pay','Saved and waiting for payment.','Nothing waiting to be paid.'],['paid','Paid','Marked paid this week. Undo moves it back.','No expenses marked paid yet.']].map(([stage,label,copy,empty])=>`<section class="expense-stage ${stage}"><div class="expense-stage-head"><div><h3><i></i>${label}<span>${grouped[stage].length}</span></h3><p>${copy}</p></div><div><small>Total</small><strong>${money(sum(grouped[stage]))}</strong></div></div>${stage==='draft'&&grouped.draft.length?`<button class="primary save-all" data-save-all="true" ${!ready||busy?'disabled':''}>▣ Save all ${grouped.draft.length}</button>`:''}${grouped[stage].length?grouped[stage].map(expenseCard).join(''):`<div class="stage-empty">${empty}</div>`}</section>`).join('')}</div>`:''}`;
}
function incomeBoardRecords() {
  const end=addDays(incomeWeek,6),search=$('#search').value.toLowerCase();
  return income.filter(r=>r.date>=incomeWeek&&r.date<=end&&(!$('#category').value||r.category===$('#category').value)&&matchesPaymentStatus(r,true,$('#status').value)&&`${r.description} ${r.source} ${r.notes||''}`.toLowerCase().includes(search)).sort((a,b)=>a.date.localeCompare(b.date));
}
function incomeCard(r) {
  const stage=incomeStage(r),label=paymentStages(true).find(([value])=>value===stage)[1];
  return `<article class="expense-pay-card"><div class="pay-card-head"><div><h3>${esc(r.source)}</h3><small>${esc(r.description)} · ${esc(scheduleLabel(r))}</small></div><div><small>Income amount</small><strong>${money(r.amount)}</strong></div></div><div class="pay-card-metrics"><div><small>Income type</small><b>${esc(r.category)}</b></div><div><small>Payment date</small><b>${dateText(r.date)}</b></div><div><small>Status</small><b>${label}</b></div></div><div class="pay-card-actions"><details><summary>⌄ Details</summary><p>${esc(r.notes||'No notes added.')}</p><button class="row-action" data-edit="${esc(r.id)}">Edit</button><button class="row-action" data-delete="${esc(r.id)}">Delete</button></details><button class="row-action" data-income-download="${esc(r.id)}" aria-label="Download income from ${esc(r.source)}">↓</button><button class="${stage==='received'?'':'primary'}" data-income-stage="${stage==='draft'?'ready':stage==='ready'?'received':'ready'}" data-income-id="${esc(r.id)}" ${!ready||busy?'disabled':''}>${stage==='draft'?'▣ Save':stage==='ready'?'✓ Mark received':'Undo'}</button></div></article>`;
}
function renderIncomeBoard() {
  const records=incomeBoardRecords(),grouped={draft:records.filter(r=>incomeStage(r)==='draft'),ready:records.filter(r=>incomeStage(r)==='ready'),received:records.filter(r=>incomeStage(r)==='received')};
  $('#income-board-view').innerHTML=`<div class="expense-board-heading"><div><h2>Income records</h2><p>Review income, save expected payments and record money received.</p></div><div class="record-tabs"><button data-income-mode="week" class="${incomeMode==='week'?'active':''}">Weekly income</button><button data-income-mode="history" class="${incomeMode==='history'?'active':''}">History</button></div></div>${incomeMode==='week'?`<div class="expense-week-toolbar"><button data-income-week="-1" aria-label="Previous income week">‹</button><b>${dateText(incomeWeek)} – ${dateText(addDays(incomeWeek,6))}</b><button data-income-week="1" aria-label="Next income week">›</button><button data-income-today="true">This week</button><button data-income-board-export="true">↓ Export CSV</button></div><div class="payroll-summary">${[['Total income',money(sum(records))],['To save',money(sum(grouped.draft))],['Ready to receive',money(sum(grouped.ready))],['Received',money(sum(grouped.received))],['Awaiting receipt',String(grouped.draft.length+grouped.ready.length)],['Received records',`${grouped.received.length} of ${records.length}`]].map(([label,value],i)=>`<div><small>${label}</small><strong class="${i===0?'accent-text':''}">${value}</strong></div>`).join('')}</div><div class="expense-board-columns income-board-columns">${[['draft','To save','Review each income record, then save it.','No income records to save.'],['ready','Ready to receive','Saved and waiting for the payment.','No payments awaiting receipt.'],['received','Received','Money received. Undo returns it to Ready to receive.','No income marked received yet.']].map(([stage,label,copy,empty])=>`<section class="expense-stage ${stage==='received'?'paid':stage}"><div class="expense-stage-head"><div><h3><i></i>${label}<span>${grouped[stage].length}</span></h3><p>${copy}</p></div><div><small>Total</small><strong>${money(sum(grouped[stage]))}</strong></div></div>${stage==='draft'&&grouped.draft.length?`<button class="primary save-all" data-income-save-all="true" ${!ready||busy?'disabled':''}>▣ Save all ${grouped.draft.length}</button>`:''}${grouped[stage].length?grouped[stage].map(incomeCard).join(''):`<div class="stage-empty">${empty}</div>`}</section>`).join('')}</div>`:''}`;
}
function calendarEvents(month) {
  const events = data.filter(r=>r.date.startsWith(month)).map(r=>({date:r.date,kind:'expense',label:r.description,amount:r.amount,status:r.status==='Paid'?'Paid':expenseStage(r)==='draft'?'Draft · due':'Due',record:r}));
  income.filter(r=>r.date.startsWith(month)).forEach(r=>events.push({date:r.date,kind:'income',label:r.source+' · '+r.description,amount:r.amount,status:incomeStage(r)==='draft'?'To save':r.status,record:r}));
  const key = (r,date)=>`${r.source.trim().toLowerCase()}|${date}|${r.amount}`;
  const recorded = new Set(income.filter(r=>incomeStage(r)!=='draft').map(r=>key(r,r.date))), projected = new Set();
  income.filter(r=>incomeStage(r)!=='draft').forEach(r=>scheduleDates(r,month).forEach(date=>{
    const k=key(r,date);if(recorded.has(k)||projected.has(k))return;projected.add(k);
    events.push({date,kind:'income',label:r.source+' · scheduled',amount:r.amount,status:'Scheduled',record:r});
  }));
  return events.sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind));
}
function renderCalendar() {
  const month=$('#month').value,[year,number]=month.split('-').map(Number),count=new Date(year,number,0).getDate(),offset=(new Date(year,number-1,1).getDay()+6)%7;
  if(!calendarDay.startsWith(month))calendarDay=today().startsWith(month)?today():month+'-01';
  const events=calendarEvents(month).filter(e=>calendarKind==='all'||e.kind===calendarKind),dayEvents=events.filter(e=>e.date===calendarDay);
  $('#finance-calendar').innerHTML=`<article class="card finance-calendar"><div class="card-head"><div><h2>Payment calendar</h2><p>Expense due dates, income receipts and scheduled paydays · PHP</p></div><div class="calendar-navigation"><button data-calendar-month="-1" aria-label="Previous calendar month">‹</button><b>${new Date(month+'-01T12:00:00').toLocaleDateString('en-PH',{month:'long',year:'numeric'})}</b><button data-calendar-month="1" aria-label="Next calendar month">›</button><button data-calendar-today="true">Today</button></div></div><div class="calendar-filters">${[['all','All payments'],['expense','Expenses'],['income','Income']].map(([kind,label])=>`<button data-calendar-kind="${kind}" class="${calendarKind===kind?'active':''}" aria-pressed="${calendarKind===kind}">${label}</button>`).join('')}<span><i class="calendar-dot expense"></i> Expense due <i class="calendar-dot income"></i> Income / payday</span></div><div class="calendar-grid"><div class="calendar-weekday">Mon</div><div class="calendar-weekday">Tue</div><div class="calendar-weekday">Wed</div><div class="calendar-weekday">Thu</div><div class="calendar-weekday">Fri</div><div class="calendar-weekday">Sat</div><div class="calendar-weekday">Sun</div>${Array.from({length:offset},()=>'<div class="calendar-blank"></div>').join('')}${Array.from({length:count},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0'),items=events.filter(e=>e.date===date);return `<button class="calendar-day ${calendarDay===date?'selected':''} ${date===today()?'is-today':''}" data-calendar-day="${date}" aria-label="${dateText(date)}, ${items.length} payments" aria-pressed="${calendarDay===date}"><b>${i+1}</b>${items.slice(0,2).map(e=>`<span class="calendar-event ${e.kind} ${e.status==='Paid'||e.status==='Received'?'complete':''}" title="${esc(e.label)} · ${esc(e.status)} · ${money(e.amount)}"><i></i><span>${esc(e.label)}</span><small>${money(e.amount)}</small></span>`).join('')}${items.length>2?`<small class="calendar-more">+${items.length-2} more</small>`:''}</button>`}).join('')}</div><div class="calendar-agenda"><h3>${dateText(calendarDay)}</h3>${dayEvents.length?dayEvents.map(e=>`<div class="agenda-item"><span class="calendar-dot ${e.kind}"></span><div><b>${esc(e.label)}</b><small>${e.kind==='expense'?'Expense due':'Income payment'} · ${esc(e.status)}</small></div><strong>${money(e.amount)}</strong></div>`).join(''):'<p>No payments on this day.</p>'}<small class="calendar-footnote">Scheduled income is a forecast. Received income and paid expenses are shown with their recorded status.</small></div></article>`;
}
function changeCalendarMonth(delta) {
  const [year,month]=$('#month').value.split('-').map(Number),date=new Date(year,month-1+delta,1,12);
  $('#month').value=dateKey(date).slice(0,7);calendarDay=$('#month').value+'-01';expenseWeek=weekStart(calendarDay);incomeWeek=expenseWeek;render();
}
function downloadCSV(rows,filename) {
  const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function summaryAnalytics() {
  const expenses = selected(), incomes = selected('income');
  const total = sum(expenses), paid = sum(expenses.filter(r => r.status === 'Paid'));
  const received = sum(incomes.filter(r => r.status === 'Received')), expected = sum(incomes.filter(r => incomeStage(r) === 'ready'));
  const budget = cats.reduce((s, c) => s + (Number(budgets[c]) || 0), 0);
  const [year, month] = $('#month').value.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(year, month - 6 + i, 1, 12), key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const incoming = sum(income.filter(r => r.date.startsWith(key) && r.status === 'Received'));
    const outgoing = sum(data.filter(r => r.date.startsWith(key) && r.status === 'Paid'));
    return { key, label: date.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' }), incoming, outgoing, net: incoming - outgoing };
  });
  const previous = months[4], previousExpenses = sum(data.filter(r => r.date.startsWith(previous.key)));
  return { expenses, incomes, total, paid, pending: total - paid, received, expected, budget, net: received - paid, months, previousExpenses, savingsRate: received ? (received - paid) / received * 100 : null };
}
function renderSummary() {
  const a = summaryAnalytics(), month = $('#month').value;
  const maximum = Math.max(...a.months.flatMap(m => [m.incoming, m.outgoing]), 1);
  const sources = new Map();
  a.incomes.filter(r => r.status === 'Received').forEach(r => {
    const key = r.source.trim().toLowerCase(), previous = sources.get(key);
    sources.set(key, { label: previous?.label || r.source.trim(), amount: (previous?.amount || 0) + r.amount });
  });
  const sourceRows = [...sources.values()].sort((x, y) => y.amount - x.amount);
  const categoryRows = budgetRows(), top = [...categoryRows].sort((x, y) => y.spent - x.spent)[0];
  const spendChange = a.previousExpenses ? (a.total - a.previousExpenses) / a.previousExpenses * 100 : null;
  const recent = [...a.expenses.map(r => ({ ...r, kind: 'expenses' })), ...a.incomes.map(r => ({ ...r, kind: 'income' }))].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 8);
  $('#summary-view').innerHTML = `
    <div class="summary-layout">
      <article class="card" id="summary-trend"><div class="card-head"><div><h2>Cash-flow analytics</h2><p>Six months ending with the selected month · received income vs paid expenses</p></div></div>
        <div class="summary-legend"><span>● Received income</span><span>● Paid expenses</span></div>
        <div class="flow-chart">${a.months.map(m => `<div class="flow-column"><div class="flow-bars"><i class="flow-income" style="height:${m.incoming / maximum * 100}%" title="${m.label} received: ${money(m.incoming)}"></i><i class="flow-expense" style="height:${m.outgoing / maximum * 100}%" title="${m.label} paid expenses: ${money(m.outgoing)}"></i></div><span>${m.label}</span><small class="${m.net < 0 ? 'negative' : ''}" title="Monthly cash balance">${money(m.net)}</small></div>`).join('')}</div>
      </article>
      <article class="card"><div class="card-head"><div><h2>Month at a glance</h2><p>Analytics for the selected month</p></div></div>
        <div class="summary-metric"><span>Cash savings rate</span><strong>${a.savingsRate === null ? '—' : a.savingsRate.toFixed(1) + '%'}</strong><small>Cash balance divided by received income</small></div>
        <div class="summary-metric"><span>Spending vs previous month</span><strong>${spendChange === null ? 'No prior spending' : (spendChange > 0 ? '+' : '') + spendChange.toFixed(1) + '%'}</strong><small>All recorded expenses; paid and pending</small></div>
        <div class="summary-metric"><span>Largest expense category</span><strong>${a.total ? top.category : 'No expenses yet'}</strong><small>${a.total ? money(top.spent) + ' · ' + (top.spent / a.total * 100).toFixed(1) + '% of spending' : 'Add expenses to see the breakdown'}</small></div>
      </article>
    </div>
    <div class="summary-dashboard-grid" id="summary-dashboards">
      <button class="card dashboard-link" data-view="expenses"><span class="eyebrow">EXPENSES ↗</span><strong>${money(a.total)}</strong><span>Paid ${money(a.paid)}</span><small>Pending ${money(a.pending)} · ${a.expenses.length} records</small><b>Open Expenses →</b></button>
      <button class="card dashboard-link" data-view="budgets"><span class="eyebrow">BUDGETS ↗</span><strong>${a.budget ? money(a.budget) : 'Not set'}</strong><span>${a.budget ? (a.total / a.budget * 100).toFixed(1) + '% of budget used' : 'Set your monthly limits'}</span><small>${categoryRows.filter(r => r.limit && r.spent > r.limit).length} over-budget categories</small><b>Open Budgets →</b></button>
      <button class="card dashboard-link" data-view="income"><span class="eyebrow">INCOME ↗</span><strong>${money(a.received)}</strong><span>Expected ${money(a.expected)}</span><small>${new Set(a.incomes.map(r => r.source.trim().toLowerCase())).size} sources · ${a.incomes.length} records</small><b>Open Income →</b></button>
    </div>
    <div class="summary-layout">
      <article class="card" id="summary-budget"><div class="card-head"><div><h2>Budget health & spending</h2><p>All expenses count toward monthly limits</p></div><button data-view="budgets">Manage →</button></div>
        ${categoryRows.map(r => `<div class="summary-budget-row"><div><span>${r.category}</span><b>${money(r.spent)} <small>/ ${r.limit ? money(r.limit) : 'No limit set'}</small></b></div><progress value="${Math.min(r.spent, r.limit)}" max="${r.limit || 1}"></progress><small>${r.limit ? r.spent > r.limit ? money(r.spent - r.limit) + ' over budget' : money(r.limit - r.spent) + ' available' : 'No monthly budget set'}</small></div>`).join('')}
      </article>
      <article class="card" id="summary-sources"><div class="card-head"><div><h2>Income sources</h2><p>Share of received income this month</p></div><button data-view="income">View →</button></div>
        ${sourceRows.length ? sourceRows.map((s, i) => `<div class="summary-source"><div><span><i style="background:${colors[i % colors.length]}"></i>${esc(s.label)}</span><b>${money(s.amount)}</b></div><small>${(s.amount / a.received * 100).toFixed(1)}% of received income</small></div>`).join('') : '<p class="empty">No received income in this month.</p>'}
        <div class="summary-upcoming"><h2>Upcoming & unpaid</h2><div><span>Expected income</span><b>${money(a.expected)}</b></div><div><span>Pending expenses</span><b>${money(a.pending)}</b></div><small>These amounts are excluded from cash-flow and savings-rate calculations.</small></div>
      </article>
    </div>
    <article class="card" id="summary-activity"><div class="card-head"><div><h2>Recent financial activity</h2><p>Latest eight income and expense records in ${esc(month)}</p></div></div><div class="table-scroll"><table><thead><tr><th>RECORD</th><th>TYPE</th><th>DATE</th><th>STATUS</th><th class="amount">AMOUNT (PHP)</th></tr></thead><tbody>${recent.length ? recent.map(r => `<tr><td>${esc(r.description)}${r.kind === 'income' ? '<small>' + esc(r.source) + '</small>' : ''}</td><td>${r.kind === 'income' ? 'Income' : 'Expense'}</td><td>${dateText(r.date)}</td><td><span class="badge ${['Expected','Pending'].includes(r.status) ? 'pending' : ''}">${esc(paymentStages(r.kind === 'income').find(([value])=>value === (r.kind === 'income' ? incomeStage(r) : expenseStage(r)))[1])}</span></td><td class="amount ${r.kind === 'income' ? 'positive' : ''}">${r.kind === 'income' ? '+' : '−'}${money(r.amount)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No activity this month. Open Expenses or Income to add records.</td></tr>'}</tbody></table></div></article>`;
}
function scheduleLabel(record) {
  const frequency = record.frequency || 'once';
  if (frequency === 'daily') return 'Every day';
  if (frequency === 'weekly') return `Every ${weekdays[record.payWeekday] || 'week'}`;
  if (frequency === 'monthly') return `Once a month · day ${record.payDay1}`;
  if (frequency === 'twice_monthly') return `Twice a month · days ${[record.payDay1, record.payDay2].sort((a,b) => a-b).join(' & ')}`;
  return 'One-time payment';
}
function scheduleDates(record, month) {
  if (!record.frequency || record.frequency === 'once') return [];
  const [year, number] = month.split('-').map(Number), lastDay = new Date(year, number, 0).getDate();
  const days = record.frequency === 'weekly' ? Array.from({length:lastDay},(_,i)=>i+1).filter(day => new Date(year,number-1,day,12).getDay() === record.payWeekday) : record.frequency === 'daily' ? Array.from({length:lastDay}, (_,i) => i+1) : [record.payDay1, ...(record.frequency === 'twice_monthly' ? [record.payDay2] : [])];
  return [...new Set(days.filter(d => Number.isInteger(d) && d >= 1 && d <= 31).map(day => `${month}-${String(Math.min(day,lastDay)).padStart(2,'0')}`))].sort().filter(date => date >= record.date);
}
function renderIncomeSchedules() {
  const month = $('#month').value, recurring = income.filter(r => r.frequency && r.frequency !== 'once' && incomeStage(r) !== 'draft');
  const entries = recurring.flatMap(record => scheduleDates(record,month).map(date => ({record,date})));
  const upcoming = entries.filter(e => e.date >= today() && !(e.record.status === 'Received' && e.record.date === e.date)).sort((a,b) => a.date.localeCompare(b.date)).slice(0,8);
  $('#income-schedule-view').innerHTML = `<article class="card income-schedules"><div class="card-head"><div><h2>Income payment schedules</h2><p>Planned paydays for the selected month · amounts are per payment</p></div><span class="badge">${entries.length} planned paydays</span></div><div class="schedule-totals"><div><small>Planned income this month</small><strong>${money(entries.reduce((s,e) => s+e.record.amount,0))}</strong></div><p>Schedules are forecasts. They do not create received payments or change your cash balance. Record each actual payment separately with “One-time payment”.</p></div><div class="schedule-columns"><div><h3>Recurring income</h3>${recurring.length ? recurring.map(r => `<div class="schedule-item"><div><b>${esc(r.source)}</b><small>${esc(r.description)} · ${esc(scheduleLabel(r))}</small><small>Starts ${dateText(r.date)} · ${money(r.amount)} per payday</small></div><button class="row-action" data-edit-schedule="${esc(r.id)}" aria-label="Edit schedule for ${esc(r.source)}">Edit</button></div>`).join('') : '<p class="empty">Add income and choose a payment schedule to see it here.</p>'}</div><div><h3>Upcoming paydays this month</h3>${upcoming.length ? upcoming.map(e => `<div class="schedule-item"><div><b>${esc(e.record.source)}</b><small>${dateText(e.date)}</small></div><strong>${money(e.record.amount)}</strong></div>`).join('') : '<p class="empty">No upcoming scheduled payments in this month.</p>'}</div></div></article>`;
}
function toggleScheduleForm() {
  const form = $('#expense-form'), isIncome = editorKind === 'income', frequency = form.elements.frequency.value || 'once';
  const monthly = isIncome && ['monthly','twice_monthly'].includes(frequency), twice = isIncome && frequency === 'twice_monthly';
  $('#income-schedule-fields').hidden = !isIncome; form.elements.frequency.disabled = !isIncome;
  $('#payday-one-field').hidden = !monthly; $('#payday-two-field').hidden = !twice;
  form.elements.payDay1.required = monthly; form.elements.payDay1.disabled = !monthly;
  form.elements.payDay2.required = twice; form.elements.payDay2.disabled = !twice;
  $('#weekday-field').hidden = !isIncome || frequency !== 'weekly'; form.elements.payWeekday.disabled = !isIncome || frequency !== 'weekly'; form.elements.payWeekday.required = isIncome && frequency === 'weekly';
  $('#record-date-label').textContent = !isIncome ? 'Due date' : frequency !== 'once' ? 'Record date / schedule starts' : 'Payment date';
  $('#schedule-help').textContent = {once:'Record a single payment on the selected date.',daily:'Paid every calendar day from the selected start date. Enter the amount for one day.',weekly:'Choose Monday through Sunday. Paydays repeat every week on that day from the start date. Enter the amount per weekly payment.',monthly:'Choose the day of the month (1–31). Shorter months use their last day. Enter the amount per payment.',twice_monthly:'Choose two different days (1–31). Shorter months use their last day; coinciding dates are counted once. Enter the amount for each payday.'}[frequency];
}
function openEditor(id) {
  editorKind = view === 'income' ? 'income' : 'expenses'; editing = id || null;
  const isIncome = editorKind === 'income', form = $('#expense-form'); form.reset();
  form.elements.description.placeholder = isIncome ? 'e.g. October salary or client payment' : 'e.g. Monthly software subscription';
  form.elements.date.value = today();
  form.elements.category.innerHTML = (isIncome ? incomeCats : cats).map(c => `<option>${c}</option>`).join('');
  form.elements.status.innerHTML = paymentStages(isIncome).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  $('#source-field').hidden = !isIncome; form.elements.source.required = isIncome;
  form.elements.frequency.value = 'once';
  form.elements.payDay1.value = ''; form.elements.payDay2.value = '';
  form.elements.payWeekday.value = '';
  $('#form-category-label').textContent = isIncome ? 'Income type' : 'Category';
  if (id) {
    const record = (isIncome ? income : data).find(e => e.id === id); if (!record) return;
    for (const key of ['description', 'amount', 'date', 'category', 'status', 'notes', 'source']) form.elements[key].value = record[key] || '';
    form.elements.frequency.value = record.frequency || 'once';
    form.elements.payDay1.value = record.payDay1 || ''; form.elements.payDay2.value = record.payDay2 || '';
    form.elements.payWeekday.value = record.payWeekday ?? '';
    form.elements.status.value = isIncome ? incomeStage(record) : expenseStage(record);
  }
  toggleScheduleForm();
  $('#modal-title').textContent = `${id ? 'Edit' : 'Add'} ${isIncome ? 'income' : 'expense'}`;
  $('#save-record').textContent = isIncome ? 'Save income' : 'Save expense'; $('#editor').showModal();
}
$('#add').onclick = () => { if (ready && !busy) openEditor(); };
$('#close').onclick = $('#cancel').onclick = () => { if (!busy) $('#editor').close(); };
$('#editor').addEventListener('cancel', e => { if (busy) e.preventDefault(); });
$('#expense-form').onsubmit = async e => {
  e.preventDefault(); if (!ready || busy) return;
  const form = e.target, amount = Number(form.elements.amount.value), isIncome = editorKind === 'income';
  const item = { id: editing || crypto.randomUUID(), description: form.elements.description.value.trim(), amount, date: form.elements.date.value, category: form.elements.category.value, status: isIncome ? form.elements.status.value === 'received' ? 'Received' : 'Expected' : form.elements.status.value === 'paid' ? 'Paid' : 'Pending', notes: form.elements.notes.value.trim(), stage:form.elements.status.value };
  if (isIncome) {
    item.source = form.elements.source.value.trim(); item.frequency = form.elements.frequency.value;
    item.payDay1 = ['monthly','twice_monthly'].includes(item.frequency) ? Number(form.elements.payDay1.value) : null;
    item.payDay2 = item.frequency === 'twice_monthly' ? Number(form.elements.payDay2.value) : null;
    item.payWeekday = item.frequency === 'weekly' ? Number(form.elements.payWeekday.value) : null;
    if (item.frequency === 'twice_monthly' && item.payDay1 === item.payDay2) { notify('Choose two different paydays.'); return; }
  }
  if (!item.description || !Number.isFinite(amount) || amount <= 0 || (isIncome && !item.source)) return;
  const button = $('#save-record'); button.disabled = true;
  try {
    if (await mutate(isIncome ? 'saveIncome' : 'saveExpense', { [isIncome ? 'income' : 'expense']: item })) {
      $('#month').value = item.date.slice(0, 7); if (!isIncome) expenseWeek = weekStart(item.date);else incomeWeek=weekStart(item.date); $('#editor').close(); render(); notify(`${isIncome ? 'Income' : 'Expense'} ${editing ? 'updated' : 'added'}`);
    }
  } finally { button.disabled = false; }
};
document.addEventListener('click', async e => {
  const incomeModeButton=e.target.closest('[data-income-mode]'),incomeWeekButton=e.target.closest('[data-income-week]'),incomeToday=e.target.closest('[data-income-today]');
  if(incomeModeButton&&!busy){incomeMode=incomeModeButton.dataset.incomeMode;$('#status').value='';render();}
  if((incomeWeekButton||incomeToday)&&!busy){incomeWeek=incomeToday?weekStart(today()):addDays(incomeWeek,Number(incomeWeekButton.dataset.incomeWeek)*7);$('#month').value=addDays(incomeWeek,3).slice(0,7);render();}
  const incomeStageButton=e.target.closest('[data-income-stage]'),incomeSaveAll=e.target.closest('[data-income-save-all]');
  if((incomeStageButton||incomeSaveAll)&&ready&&!busy){
    const ids=incomeSaveAll?incomeBoardRecords().filter(r=>incomeStage(r)==='draft').map(r=>r.id):[incomeStageButton.dataset.incomeId],target=incomeSaveAll?'ready':incomeStageButton.dataset.incomeStage;
    let success=true;for(let i=0;i<ids.length;i+=500){if(!await mutate('setIncomeStage',{ids:ids.slice(i,i+500),stage:target})){success=false;break;}}
    if(success&&ids.length)notify(target==='received'?'Income marked received':'Income saved and ready to receive');
  }
  const singleIncomeExport=e.target.closest('[data-income-download]'),incomeBoardExport=e.target.closest('[data-income-board-export]');
  if((singleIncomeExport||incomeBoardExport)&&ready){const records=singleIncomeExport?income.filter(r=>r.id===singleIncomeExport.dataset.incomeDownload):incomeBoardRecords();downloadCSV([['Source','Income','Amount (PHP)','Payment date','Stage','Schedule','Notes'],...records.map(r=>[r.source,r.description,r.amount,r.date,incomeStage(r),scheduleLabel(r),r.notes||''])],`PrimeSphere-income-${incomeWeek}-PHP.csv`);}
  const mode=e.target.closest('[data-expense-mode]'),week=e.target.closest('[data-expense-week]'),thisWeek=e.target.closest('[data-expense-today]');
  if(mode&&!busy){expenseMode=mode.dataset.expenseMode;$('#status').value='';render();}
  if((week||thisWeek)&&!busy){expenseWeek=thisWeek?weekStart(today()):addDays(expenseWeek,Number(week.dataset.expenseWeek)*7);$('#month').value=addDays(expenseWeek,3).slice(0,7);render();}
  const stage=e.target.closest('[data-expense-stage]'),saveAll=e.target.closest('[data-save-all]');
  if((stage||saveAll)&&ready&&!busy){
    const ids=saveAll?expenseBoardRecords().filter(r=>expenseStage(r)==='draft').map(r=>r.id):[stage.dataset.expenseId],target=saveAll?'ready':stage.dataset.expenseStage;
    let success=true;for(let i=0;i<ids.length;i+=500){if(!await mutate('setExpenseStage',{ids:ids.slice(i,i+500),stage:target})){success=false;break;}}
    if(success&&ids.length)notify(target==='paid'?'Expense marked paid':target==='ready'?'Expense saved and ready to pay':'Expense updated');
  }
  const singleExport=e.target.closest('[data-expense-download]'),boardExport=e.target.closest('[data-board-export]');
  if((singleExport||boardExport)&&ready){const records=singleExport?data.filter(r=>r.id===singleExport.dataset.expenseDownload):expenseBoardRecords();downloadCSV([['Expense','Amount (PHP)','Due date','Category','Stage','Notes'],...records.map(r=>[r.description,r.amount,r.date,r.category,expenseStage(r),r.notes||''])],`PrimeSphere-expenses-${expenseWeek}-PHP.csv`);}
  const calendarMonth=e.target.closest('[data-calendar-month]'),calendarToday=e.target.closest('[data-calendar-today]'),calendarDate=e.target.closest('[data-calendar-day]'),calendarFilter=e.target.closest('[data-calendar-kind]');
  if(calendarMonth)changeCalendarMonth(Number(calendarMonth.dataset.calendarMonth));
  if(calendarToday){$('#month').value=today().slice(0,7);calendarDay=today();expenseWeek=weekStart(today());incomeWeek=expenseWeek;render();}
  if(calendarDate){calendarDay=calendarDate.dataset.calendarDay;renderCalendar();}
  if(calendarFilter){calendarKind=calendarFilter.dataset.calendarKind;renderCalendar();}
  if(e.target.closest('[data-open-calendar]'))$('#finance-calendar').scrollIntoView({behavior:'smooth',block:'start'});
  const schedule = e.target.closest('[data-edit-schedule]');
  if (schedule && ready && !busy && view === 'income') openEditor(schedule.dataset.editSchedule);
  const edit = e.target.closest('[data-edit]'), del = e.target.closest('[data-delete]'), nav = e.target.closest('[data-view]');
  if (edit && ready && !busy) openEditor(edit.dataset.edit);
  if (del && ready && !busy) {
    const kind = view === 'income' ? 'income' : 'expense';
    if (confirm(`Delete this ${kind} record?`) && await mutate(kind === 'income' ? 'deleteIncome' : 'deleteExpense', { id: del.dataset.delete })) notify(`${kind === 'income' ? 'Income' : 'Expense'} deleted`);
  }
  if (nav && !busy) switchView(nav.dataset.view);
  const context = e.target.closest('[data-context-all], [data-context-status], [data-context-category], [data-budget-focus], [data-budget-home]');
  if (context && !busy) contextAction(context);
  const anchor = e.target.closest('[data-summary-anchor]');
  if (anchor && view === 'summary') document.querySelector('#summary-' + anchor.dataset.summaryAnchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.addEventListener('change', async e => {
  if (!e.target.matches('[data-budget]')) return;
  const input = e.target, n = Number(input.value);
  if (!input.checkValidity() || !Number.isFinite(n) || !ready || busy) return;
  input.disabled = true;
  const saved = await mutate('saveBudget', { category: input.dataset.budget, amount: n });
  render(); if (saved) notify('Monthly budget saved');
});
for (const selector of ['#month', '#category', '#status']) $(selector).onchange = () => { if ($('#month').value) { if(selector==='#month'){expenseWeek=weekStart($('#month').value+'-01');incomeWeek=expenseWeek;calendarDay=$('#month').value+'-01';} render(); } };
$('#search').oninput = render;
$('#expense-form [name="frequency"]').onchange = toggleScheduleForm;
function exportRows() {
  if (view === 'summary') {
    const a = summaryAnalytics();
    return [['Metric', 'Amount (PHP)', 'Month'], ...[['Received income', a.received], ['Expected income', a.expected], ['Total expenses', a.total], ['Paid expenses', a.paid], ['Pending expenses', a.pending], ['Cash balance', a.net], ['Monthly budget', a.budget], ['Budget remaining', a.budget ? a.budget - a.total : '']].map(([label, amount]) => [label, amount, $('#month').value])];
  }
  if (view === 'budgets') return [['Category', 'Budget (PHP)', 'Spent (PHP)', 'Remaining (PHP)', 'Month'], ...budgetRows().map(r => [r.category, r.limit, r.spent, r.limit - r.spent, $('#month').value])];
  const isIncome = view === 'income';
  const records=isIncome?incomeMode==='week'?incomeBoardRecords():filtered().filter(r=>r.status==='Received'):expenseMode==='week'?expenseBoardRecords():filtered().filter(r=>r.status==='Paid');
  return [['Description', ...(isIncome ? ['Source'] : []), 'Amount (PHP)', isIncome?'Date':'Due date', isIncome ? 'Income type' : 'Category', 'Status', 'Notes', ...(isIncome ? ['Frequency','Payday 1','Payday 2','Weekday','Stage'] : ['Stage'])], ...records.map(r => [r.description, ...(isIncome ? [r.source] : []), r.amount, r.date, r.category, r.status, r.notes || '', ...(isIncome ? [r.frequency || 'once',r.payDay1 || '',r.payDay2 || '',r.frequency==='weekly'?weekdays[r.payWeekday]:'',incomeStage(r)] : [expenseStage(r)])])];
}
$('#export').onclick = () => {
  if (!ready) return;
  const csv = exportRows().map(row => row.map(v => '"' + String(v).replace(/^[=+@\-]/, "'$&").replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })), a = document.createElement('a');
  a.href = url; a.download = `PrimeSphere-${view === 'summary' ? 'overview' : view}-${$('#month').value}-PHP.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('Peso CSV export downloaded');
};
$('#login').addEventListener('cancel', e => e.preventDefault());
$('#login-form').onsubmit = async e => {
  e.preventDefault(); const button = $('#login-submit'); button.disabled = true; $('#login-error').textContent = '';
  try { await api('login', { password: e.target.elements.password.value }); e.target.reset(); $('#login').close(); await load(); }
  catch (error) { $('#login-error').textContent = error.message; }
  finally { button.disabled = false; }
};
$('#signout').onclick = async () => {
  if (busy) return;
  try { await api('logout'); ready = false; clearState(); render(); connection('Signed out'); $('#login').showModal(); }
  catch (error) { notify(error.message); }
};
$('#retry').onclick = load;
setFilters(); render(); load();
