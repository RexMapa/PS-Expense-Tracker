export const categories = ['Software', 'Marketing', 'Travel', 'Office', 'Other'];
export const incomeCategories = ['Salary', 'Freelance', 'Business', 'Investments', 'Other'];
export function validId(id) { return typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id); }
export function validAmount(n, allowZero = false) {
  return typeof n === 'number' && Number.isFinite(n) && n >= (allowZero ? 0 : 0.01) && n <= 999999999 && Math.abs(n * 100 - Math.round(n * 100)) < 0.0001;
}
export function validateExpense(e) {
  if (!e || !validId(e.id) || typeof e.description !== 'string' || !e.description.trim() || e.description.trim().length > 100 || !validAmount(e.amount) || !categories.includes(e.category) || !['Paid', 'Pending'].includes(e.status) || typeof e.notes !== 'string' || e.notes.length > 500) return false;
  if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || e.date < '0001-01-01') return false;
  const parsed = new Date(e.date + 'T12:00:00Z');
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === e.date;
}
export function validateIncome(e) {
  if (!e || typeof e.source !== 'string' || !e.source.trim() || e.source.trim().length > 100 || !incomeCategories.includes(e.category) || !['Received', 'Expected'].includes(e.status)) return false;
  const frequency = e.frequency ?? 'once';
  if (!['once', 'monthly', 'twice_monthly', 'daily'].includes(frequency)) return false;
  const day = n => Number.isInteger(n) && n >= 1 && n <= 31;
  if (['monthly', 'twice_monthly'].includes(frequency) && !day(e.payDay1)) return false;
  if (frequency === 'twice_monthly' && (!day(e.payDay2) || e.payDay1 === e.payDay2)) return false;
  // The common record fields share the expense amount, date and text rules.
  return validateExpense({ ...e, category: 'Other', status: 'Paid' });
}
