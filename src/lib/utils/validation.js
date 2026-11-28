/**
 * Form validation shared by the auth screens and profile setup.
 *
 * Rules are deliberately strict-but-friendly: they explain the problem and
 * how to fix it instead of just saying "invalid".
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 8;
export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 160;
export const MESSAGE_MAX = 4000;
export const GROUP_NAME_MAX = 48;

/** Lowercased username handle used for profile URLs and uniqueness lookups. */
export function normaliseUsername(username) {
  return String(username || '').trim().toLowerCase();
}

/**
 * Usernames: 3–24 chars, lowercase letters/numbers/underscore/hyphen,
 * must start and end with a letter or number.
 */
export function validateUsername(username) {
  const value = String(username || '').trim();
  if (!value) return 'Choose a username.';
  if (value.length < USERNAME_MIN) return `Usernames need at least ${USERNAME_MIN} characters.`;
  if (value.length > USERNAME_MAX) return `Usernames can be at most ${USERNAME_MAX} characters.`;
  if (!/^[a-zA-Z0-9]/.test(value)) return 'Start with a letter or number.';
  if (!/[a-zA-Z0-9]$/.test(value)) return 'End with a letter or number.';
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    return 'Use only letters, numbers, dots, underscores or hyphens.';
  }
  if (/[._-]{2,}/.test(value)) return 'Avoid repeating dots, underscores or hyphens.';
  return '';
}

export function validateEmail(email) {
  const value = String(email || '').trim();
  if (!value) return 'Enter your email address.';
  // Intentionally pragmatic: real deliverability is checked by Firebase.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return 'That email address looks incomplete.';
  if (value.length > 254) return 'That email address is too long.';
  return '';
}

export function validatePassword(password) {
  const value = String(password || '');
  if (!value) return 'Enter a password.';
  if (value.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (value.length > 128) return 'Passwords can be at most 128 characters.';
  if (!/[a-zA-Z]/.test(value)) return 'Include at least one letter.';
  if (!/[0-9]/.test(value)) return 'Include at least one number.';
  return '';
}

/** 0–4 score used by the strength meter (does not block submission). */
export function passwordStrength(password) {
  const value = String(password || '');
  if (!value) return { score: 0, label: 'Empty' };
  let score = 0;
  if (value.length >= PASSWORD_MIN) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value) && /[^a-zA-Z0-9]/.test(value)) score += 1;
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: Math.min(score, 4), label: labels[Math.min(score, 4)] };
}

export function validateDisplayName(name) {
  const value = String(name || '').trim();
  if (!value) return 'Add a display name.';
  if (value.length < 2) return 'Display names need at least 2 characters.';
  if (value.length > DISPLAY_NAME_MAX) return `Keep it under ${DISPLAY_NAME_MAX} characters.`;
  return '';
}

export function validateBio(bio) {
  const value = String(bio || '').trim();
  if (value.length > BIO_MAX) return `Bios can be at most ${BIO_MAX} characters.`;
  return '';
}

/** Returns the first error in a { field: error } map, or ''. */
export function firstError(errors) {
  return Object.values(errors || {}).find(Boolean) || '';
}

/** True when a validation map has no errors. */
export function isValid(errors) {
  return !Object.values(errors || {}).some(Boolean);
}

/** Suggest an available-looking username from a display name or email. */
export function suggestUsername(source) {
  const base = String(source || '')
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, USERNAME_MAX - 4);
  return base || 'chazter';
}
