/**
 * Timestamp helpers.
 *
 * Firestore mixes three shapes in practice: server Timestamps, JS Dates
 * (optimistic updates) and millisecond numbers. Every helper here normalises
 * to a millisecond number so components never have to care.
 */

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatTime(value) {
  const ms = toMillis(value);
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** WhatsApp-style relative day label: "Today", "Yesterday", weekday, or date. */
export function formatDayLabel(value, now = Date.now()) {
  const ms = toMillis(value);
  if (!ms) return '';
  const date = new Date(ms);
  const today = startOfDay(now);
  const target = startOfDay(date);
  const diffDays = Math.round((today - target) / DAY);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }
  const sameYear = new Date(now).getFullYear() === date.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Compact stamp used in the conversation list. */
export function formatListStamp(value, now = Date.now()) {
  const ms = toMillis(value);
  if (!ms) return '';
  const date = new Date(ms);
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (diffDays === 0) return formatTime(ms);
  if (diffDays === 1) return 'Yesterday';
  const sameYear = new Date(now).getFullYear() === date.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: '2-digit' }),
  });
}

/** "Active 5m ago", "Last seen yesterday", etc. */
export function formatLastSeen(value, now = Date.now()) {
  const ms = toMillis(value);
  if (!ms) return 'Offline';
  const diff = Math.max(0, now - ms);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Active just now';
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Active yesterday';
  if (days < 7) return `Active ${days}d ago`;
  return `Last seen ${formatDayLabel(ms, now).toLowerCase()}`;
}

/** Full date + time, for message tooltips and profile metadata. */
export function formatDateTime(value) {
  const ms = toMillis(value);
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Should two consecutive messages show a day divider between them? */
export function isDifferentDay(a, b) {
  if (!a || !b) return true;
  return startOfDay(toMillis(a)).getTime() !== startOfDay(toMillis(b)).getTime();
}

/** Human "member for" label, e.g. "Joined March 2025". */
export function formatMonthYear(value) {
  const ms = toMillis(value);
  if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export const dayInMs = DAY;
