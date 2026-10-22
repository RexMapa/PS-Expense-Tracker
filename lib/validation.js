export const categories = ['Software', 'Marketing', 'Travel', 'Office', 'Other'];
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
