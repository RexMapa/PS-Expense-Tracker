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
let data = [], income = [], budgets = {}, view = 'expenses', editing = null, editorKind = 'expenses', ready = false, busy = false;
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
  finally { busy = false; $('#add').disabled = !ready; }
}
function selected(kind = 'expenses') {
  return (kind === 'income' ? income : data).filter(record => record.date.startsWith($('#month').value));
}
function filtered() {
  const kind = view === 'income' ? 'income' : 'expenses';
  return selected(kind).filter(record => (!$('#category').value || record.category === $('#category').value)
    && (!$('#status').value || record.status === $('#status').value)
    && `${record.description} ${record.source || ''} ${record.notes || ''}`.toLowerCase().includes($('#search').value.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
}
function setFilters() {
  if (!filters[view]) return;
  const isIncome = view === 'income', options = isIncome ? incomeCats : cats;
  $('#category').innerHTML = '<option value="">All ' + (isIncome ? 'types' : 'categories') + '</option>' + options.map(c => `<option>${c}</option>`).join('');
  $('#status').innerHTML = '<option value="">All statuses</option>' + (isIncome ? ['Received', 'Expected'] : ['Paid', 'Pending']).map(c => `<option>${c}</option>`).join('');
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
  const isIncome = view === 'income', rows = filtered();
  $('#table-title').textContent = isIncome ? 'Income records' : 'Expense records';
  $('#table-copy').textContent = isIncome ? 'Track received and expected payments from every source' : 'All your expense records for the selected month';
  $('#record-heading').textContent = isIncome ? 'INCOME / SOURCE' : 'EXPENSE';
  $('#category-heading').textContent = isIncome ? 'TYPE' : 'CATEGORY';
  $('#result-count').textContent = rows.length + ' records';
  $('#rows').innerHTML = rows.length ? rows.map(record => `<tr><td><div class="expense-cell"><span class="expense-icon">${esc(record.description.charAt(0).toUpperCase())}</span><span>${esc(record.description)}${isIncome ? '<small>' + esc(record.source) + '</small>' : ''}</span></div></td><td>${esc(record.category)}</td><td>${dateText(record.date)}</td><td><span class="badge ${['Pending', 'Expected'].includes(record.status) ? 'pending' : ''}">${esc(record.status)}</span></td><td class="amount">${money(record.amount)}</td><td><button class="row-action" data-edit="${esc(record.id)}" aria-label="Edit ${esc(record.description)}">Edit</button><button class="row-action" data-delete="${esc(record.id)}" aria-label="Delete ${esc(record.description)}">×</button></td></tr>`).join('') : `<tr><td colspan="6" class="empty">No ${isIncome ? 'income' : 'expenses'} found. ${isIncome ? 'Add an income source or payment' : 'Add an expense'} to get started.</td></tr>`;
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
  const records = selected(isIncome ? 'income' : 'expenses'), category = $('#category').value, status = $('#status').value;
  const all = !category && !status;
  const statuses = isIncome ? ['Received', 'Expected'] : ['Paid', 'Pending'];
  $('#context-nav').innerHTML = `<button data-context-all="true" class="${all ? 'active' : ''}">≡ <span>All ${isIncome ? 'income' : 'expenses'}</span><em>${records.length}</em></button><div class="context-label">PAYMENT STATUS</div>`
    + statuses.map(s => `<button data-context-status="${s}" class="${status === s ? 'active' : ''}"><span class="context-dot"></span><span>${s}</span><em>${records.filter(r => r.status === s).length}</em></button>`).join('')
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
  if (button.dataset.contextAll) { $('#category').value = ''; $('#status').value = ''; }
  else if (button.dataset.contextStatus) { $('#category').value = ''; $('#status').value = button.dataset.contextStatus; }
  else if (button.dataset.contextCategory) { $('#status').value = ''; $('#category').value = button.dataset.contextCategory; }
  render();
}
function render() {
  const expenses = selected(), incomeRecords = selected('income'), total = sum(expenses);
  const pending = sum(expenses.filter(e => e.status === 'Pending'));
  const receivedRecords = incomeRecords.filter(e => e.status === 'Received'), received = sum(receivedRecords);
  const expected = sum(incomeRecords.filter(e => e.status === 'Expected'));
  const rows = budgetRows(), budget = rows.reduce((s, row) => s + row.limit, 0);
  const labels = { summary: 'Overview', expenses: 'Expenses', budgets: 'Budgets', income: 'Income sources' };
  $('#period-label').textContent = new Date($('#month').value + '-01T12:00:00').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  renderSidebar();
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
    renderActivity(receivedRecords, breakdown, received, true); renderTable();
  } else {
    renderStats([['Total expenses', money(total), 'Recorded this month', '↗'], ['Paid expenses', money(total - pending), 'Payments completed', '✓'], ['Pending payments', money(pending), 'Payments awaiting completion', '◷'], ['Largest category', total ? cats[cats.map(c => sum(expenses.filter(e => e.category === c))).indexOf(Math.max(...cats.map(c => sum(expenses.filter(e => e.category === c)))))] : '—', total ? money(Math.max(...cats.map(c => sum(expenses.filter(e => e.category === c))))) + ' this month' : 'No spending recorded', '◈']]);
    renderActivity(expenses, cats.map(c => [c, sum(expenses.filter(e => e.category === c))]), total, false); renderTable();
  }
}
function summaryAnalytics() {
  const expenses = selected(), incomes = selected('income');
  const total = sum(expenses), paid = sum(expenses.filter(r => r.status === 'Paid'));
  const received = sum(incomes.filter(r => r.status === 'Received')), expected = sum(incomes.filter(r => r.status === 'Expected'));
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
    <article class="card" id="summary-activity"><div class="card-head"><div><h2>Recent financial activity</h2><p>Latest eight income and expense records in ${esc(month)}</p></div></div><div class="table-scroll"><table><thead><tr><th>RECORD</th><th>TYPE</th><th>DATE</th><th>STATUS</th><th class="amount">AMOUNT (PHP)</th></tr></thead><tbody>${recent.length ? recent.map(r => `<tr><td>${esc(r.description)}${r.kind === 'income' ? '<small>' + esc(r.source) + '</small>' : ''}</td><td>${r.kind === 'income' ? 'Income' : 'Expense'}</td><td>${dateText(r.date)}</td><td><span class="badge ${['Expected','Pending'].includes(r.status) ? 'pending' : ''}">${esc(r.status)}</span></td><td class="amount ${r.kind === 'income' ? 'positive' : ''}">${r.kind === 'income' ? '+' : '−'}${money(r.amount)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No activity this month. Open Expenses or Income to add records.</td></tr>'}</tbody></table></div></article>`;
}
function openEditor(id) {
  editorKind = view === 'income' ? 'income' : 'expenses'; editing = id || null;
  const isIncome = editorKind === 'income', form = $('#expense-form'); form.reset();
  form.elements.description.placeholder = isIncome ? 'e.g. October salary or client payment' : 'e.g. Monthly software subscription';
  form.elements.date.value = today();
  form.elements.category.innerHTML = (isIncome ? incomeCats : cats).map(c => `<option>${c}</option>`).join('');
  form.elements.status.innerHTML = (isIncome ? ['Received', 'Expected'] : ['Paid', 'Pending']).map(c => `<option>${c}</option>`).join('');
  $('#source-field').hidden = !isIncome; form.elements.source.required = isIncome;
  $('#form-category-label').textContent = isIncome ? 'Income type' : 'Category';
  if (id) {
    const record = (isIncome ? income : data).find(e => e.id === id); if (!record) return;
    for (const key of ['description', 'amount', 'date', 'category', 'status', 'notes', 'source']) form.elements[key].value = record[key] || '';
  }
  $('#modal-title').textContent = `${id ? 'Edit' : 'Add'} ${isIncome ? 'income' : 'expense'}`;
  $('#save-record').textContent = isIncome ? 'Save income' : 'Save expense'; $('#editor').showModal();
}
$('#add').onclick = () => { if (ready && !busy) openEditor(); };
$('#close').onclick = $('#cancel').onclick = () => { if (!busy) $('#editor').close(); };
$('#editor').addEventListener('cancel', e => { if (busy) e.preventDefault(); });
$('#expense-form').onsubmit = async e => {
  e.preventDefault(); if (!ready || busy) return;
  const form = e.target, amount = Number(form.elements.amount.value), isIncome = editorKind === 'income';
  const item = { id: editing || crypto.randomUUID(), description: form.elements.description.value.trim(), amount, date: form.elements.date.value, category: form.elements.category.value, status: form.elements.status.value, notes: form.elements.notes.value.trim() };
  if (isIncome) item.source = form.elements.source.value.trim();
  if (!item.description || !Number.isFinite(amount) || amount <= 0 || (isIncome && !item.source)) return;
  const button = $('#save-record'); button.disabled = true;
  try {
    if (await mutate(isIncome ? 'saveIncome' : 'saveExpense', { [isIncome ? 'income' : 'expense']: item })) {
      $('#month').value = item.date.slice(0, 7); $('#editor').close(); render(); notify(`${isIncome ? 'Income' : 'Expense'} ${editing ? 'updated' : 'added'}`);
    }
  } finally { button.disabled = false; }
};
document.addEventListener('click', async e => {
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
for (const selector of ['#month', '#category', '#status']) $(selector).onchange = () => { if ($('#month').value) render(); };
$('#search').oninput = render;
function exportRows() {
  if (view === 'summary') {
    const a = summaryAnalytics();
    return [['Metric', 'Amount (PHP)', 'Month'], ...[['Received income', a.received], ['Expected income', a.expected], ['Total expenses', a.total], ['Paid expenses', a.paid], ['Pending expenses', a.pending], ['Cash balance', a.net], ['Monthly budget', a.budget], ['Budget remaining', a.budget ? a.budget - a.total : '']].map(([label, amount]) => [label, amount, $('#month').value])];
  }
  if (view === 'budgets') return [['Category', 'Budget (PHP)', 'Spent (PHP)', 'Remaining (PHP)', 'Month'], ...budgetRows().map(r => [r.category, r.limit, r.spent, r.limit - r.spent, $('#month').value])];
  const isIncome = view === 'income';
  return [['Description', ...(isIncome ? ['Source'] : []), 'Amount (PHP)', 'Date', isIncome ? 'Income type' : 'Category', 'Status', 'Notes'], ...filtered().map(r => [r.description, ...(isIncome ? [r.source] : []), r.amount, r.date, r.category, r.status, r.notes || ''])];
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
