export const formatPrice = (value, currency = 'INR') =>
  value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function timeAgo(value) {
  if (!value) return 'never';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const future = seconds < 0;
  const s = Math.abs(seconds);
  const text = s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} d`;
  return future ? `in ${text}` : `${text} ago`;
}

export const formatInterval = (minutes) =>
  minutes % 60 === 0 ? `every ${minutes / 60} h` : `every ${minutes} min`;

export const formatStock = (inStock, quantity) =>
  inStock == null ? '—' : inStock ? `In stock${quantity != null ? ` (${quantity})` : ''}` : 'Out of stock';
