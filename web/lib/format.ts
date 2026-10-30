const DATE = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATE.format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATE_TIME.format(d);
}

export function formatMoney(cents: number, currency = 'MAD'): string {
  const amount = cents / 100;
  const digits = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  if (currency === 'MAD') return `${digits} درهم`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} يوم ${h} س`;
  if (h > 0) return `${h} س ${m} د`;
  return `${m} د`;
}
