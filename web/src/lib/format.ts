/** The API stores UTC but serializes timestamps without a zone designator, e.g. "2026-11-16T08:48:49.2". */
export function parseUtc(value: string): Date {
  return new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function formatDateTime(value: string): string {
  return `${dateTimeFormat.format(parseUtc(value))} UTC`;
}

export function formatDate(value: string): string {
  return dateFormat.format(parseUtc(value));
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** "14:05 UTC". */
export function formatTime(value: string): string {
  return `${timeFormat.format(parseUtc(value))} UTC`;
}

/** `now` is passed in so callers decide when the clock is read (only ever at request time). */
export function formatRelative(value: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - parseUtc(value).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** For things that end later: "in 3 days", "in 5 h", "ended". */
export function formatUntil(value: string, now: number): string {
  const seconds = Math.round((parseUtc(value).getTime() - now) / 1000);
  if (seconds <= 0) return 'ended';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in ${Math.max(minutes, 1)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return `in ${days} days`;
}

const amountFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatAmount(value: number): string {
  return amountFormat.format(value);
}

export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return letters || '?';
}
