import { describe, expect, it } from 'vitest';
import {
  toMillis,
  formatDayLabel,
  formatListStamp,
  formatLastSeen,
  isDifferentDay,
  formatMonthYear,
} from '../lib/utils/time.js';

const NOW = new Date('2026-11-28T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

describe('toMillis', () => {
  it('normalises every timestamp shape Firestore produces', () => {
    const date = new Date(NOW);
    expect(toMillis(date)).toBe(NOW);
    expect(toMillis(NOW)).toBe(NOW);
    expect(toMillis({ toMillis: () => NOW })).toBe(NOW);
    expect(toMillis({ toDate: () => date })).toBe(NOW);
    expect(toMillis({ seconds: NOW / 1000, nanoseconds: 0 })).toBe(NOW);
  });

  it('returns 0 for empty values', () => {
    expect(toMillis(null)).toBe(0);
    expect(toMillis(undefined)).toBe(0);
    expect(toMillis('')).toBe(0);
    expect(toMillis('not a date')).toBe(0);
  });
});

describe('day labels', () => {
  it('labels today, yesterday, this week and older dates', () => {
    expect(formatDayLabel(NOW, NOW)).toBe('Today');
    expect(formatDayLabel(NOW - DAY, NOW)).toBe('Yesterday');
    expect(formatDayLabel(NOW - 3 * DAY, NOW)).toMatch(/day$/);
    expect(formatDayLabel(NOW - 400 * DAY, NOW)).toMatch(/2025/);
  });

  it('treats midnight boundaries as different days', () => {
    const lateLastNight = new Date('2026-11-27T23:59:00Z').getTime();
    const earlyToday = new Date('2026-11-28T00:01:00Z').getTime();
    expect(isDifferentDay(lateLastNight, earlyToday)).toBe(true);
    expect(isDifferentDay(earlyToday, earlyToday + 60000)).toBe(false);
  });

  it('list stamps collapse to a time for today', () => {
    expect(formatListStamp(NOW, NOW)).toMatch(/\d/);
    expect(formatListStamp(NOW - DAY, NOW)).toBe('Yesterday');
  });
});

describe('last seen', () => {
  it('describes recency in human terms', () => {
    expect(formatLastSeen(NOW - 20 * 1000, NOW)).toBe('Active just now');
    expect(formatLastSeen(NOW - 5 * 60 * 1000, NOW)).toBe('Active 5m ago');
    expect(formatLastSeen(NOW - 3 * 60 * 60 * 1000, NOW)).toBe('Active 3h ago');
    expect(formatLastSeen(NOW - DAY, NOW)).toBe('Active yesterday');
    expect(formatLastSeen(0, NOW)).toBe('Offline');
  });
});

describe('formatMonthYear', () => {
  it('renders a human month + year', () => {
    expect(formatMonthYear(new Date('2026-03-04T00:00:00Z').getTime())).toMatch(/March 2026/);
    expect(formatMonthYear(null)).toBe('');
  });
});
