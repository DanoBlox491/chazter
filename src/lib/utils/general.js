/**
 * Shared, framework-agnostic utilities.
 */

/** Join class names, ignoring falsy values. */
export function cx(...values) {
  return values.filter(Boolean).join(' ');
}

export const noop = () => {};

/** Promise-based delay. */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Clamp a number between min and max. */
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Return `value` truncated to `max` characters, adding an ellipsis when cut. */
export function truncate(value, max = 80) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Strip dangerous protocols from user-controlled URLs before rendering them. */
export function isSafeUrl(url, { allowDataImage = false } = {}) {
  if (typeof url !== 'string' || !url) return false;
  if (allowDataImage && url.startsWith('data:image/')) return true;
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:', 'blob:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/** Trailing-edge debounce. */
export function debounce(fn, wait = 250) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/** Stable pseudo-random id for optimistic UI keys. */
export function randomId(prefix = 't') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
