import { describe, expect, it } from 'vitest';
import {
  normaliseUsername,
  validateUsername,
  validateEmail,
  validatePassword,
  passwordStrength,
  validateDisplayName,
  validateBio,
  suggestUsername,
  firstError,
  isValid,
} from '../lib/utils/validation.js';

describe('usernames', () => {
  it('accepts sensible handles', () => {
    for (const handle of ['ada', 'ada_l', 'ada-l', 'a.d.a', 'Ada99', 'abc']) {
      expect(validateUsername(handle), handle).toBe('');
    }
  });

  it('rejects handles that break URLs or lookups', () => {
    for (const handle of ['', 'ab', 'a'.repeat(25), '-ada', 'ada-', '.ada', 'ada l', 'ada!', 'ada__x', '_ada']) {
      expect(validateUsername(handle), `"${handle}"`).not.toBe('');
    }
  });

  it('normalises casing and whitespace for the uniqueness key', () => {
    expect(normaliseUsername('  Ada ')).toBe('ada');
    expect(normaliseUsername(undefined)).toBe('');
  });
});

describe('email', () => {
  it('accepts normal addresses', () => {
    for (const value of ['a@b.co', 'ada.lovelace+chazter@example.org', 'x@y.io']) {
      expect(validateEmail(value), value).toBe('');
    }
  });

  it('rejects malformed addresses', () => {
    for (const value of ['', 'ada', 'ada@', 'ada@b', 'ada@b.', '@example.com', 'a b@c.com']) {
      expect(validateEmail(value), value).not.toBe('');
    }
  });
});

describe('password policy', () => {
  it('requires 8+ characters with a letter and a number', () => {
    expect(validatePassword('short1')).not.toBe('');
    expect(validatePassword('allletters')).not.toBe('');
    expect(validatePassword('12345678')).not.toBe('');
    expect(validatePassword('chazter2026')).toBe('');
  });

  it('scores strength monotonically', () => {
    expect(passwordStrength('').score).toBe(0);
    expect(passwordStrength('abcdefgh').score).toBeLessThan(passwordStrength('Abcdefg1').score);
    expect(passwordStrength('Correct-Horse-42!').score).toBe(4);
  });
});

describe('profile fields', () => {
  it('validates display names', () => {
    expect(validateDisplayName('A')).not.toBe('');
    expect(validateDisplayName('Ada Lovelace')).toBe('');
    expect(validateDisplayName('x'.repeat(41))).not.toBe('');
  });

  it('caps bio length', () => {
    expect(validateBio('x'.repeat(161))).not.toBe('');
    expect(validateBio('Short bio')).toBe('');
  });

  it('suggests a valid username from a name or email', () => {
    for (const source of ['Ada Lovelace', 'ada.lovelace@example.com', '!!!', '']) {
      expect(validateUsername(suggestUsername(source))).toBe('');
    }
    expect(suggestUsername('ada.lovelace@example.com')).toBe('ada.lovelace');
  });
});

describe('form helpers', () => {
  it('finds the first error and reports validity', () => {
    expect(firstError({ a: '', b: 'broken' })).toBe('broken');
    expect(firstError({})).toBe('');
    expect(isValid({ a: '', b: '' })).toBe(true);
    expect(isValid({ a: 'x' })).toBe(false);
  });
});
