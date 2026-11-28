import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  applyPreferences,
  getPreferences,
  hydratePreferences,
  resetPreferences,
  setPreferences,
  subscribePreferences,
} from '../lib/preferences.js';

/**
 * These tests exist because the previous "Reduce motion" switch was a lie: it
 * rendered, it moved, and it changed nothing (`checked={false}` /
 * `onChange={() => {}}`). The contract proved here is that every preference
 * reaches the DOM, survives a reload, and can be turned back off.
 */
describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-motion');
    document.documentElement.removeAttribute('data-latency');
    document.documentElement.removeAttribute('data-hwaccel');
    document.documentElement.removeAttribute('data-ambient');
    document.documentElement.removeAttribute('data-launch');
    document.documentElement.classList.remove('prefers-reduced-motion');
    resetPreferences();
  });

  it('applies no attributes at the defaults', () => {
    applyPreferences(DEFAULT_PREFERENCES);
    const root = document.documentElement;
    expect(root.hasAttribute('data-motion')).toBe(false);
    expect(root.hasAttribute('data-latency')).toBe(false);
    // Defaults: GPU on, ambient on, instant launch on → all inverted to absent.
    expect(root.hasAttribute('data-hwaccel')).toBe(false);
    expect(root.hasAttribute('data-ambient')).toBe(false);
    // Instant launch is on by default, so <html> is marked accordingly.
    expect(root.getAttribute('data-launch')).toBe('instant');
  });

  it('reduce motion sets the attribute the CSS keys off', () => {
    setPreferences({ reduceMotion: true });
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
    expect(document.documentElement.classList.contains('prefers-reduced-motion')).toBe(true);

    setPreferences({ reduceMotion: false });
    expect(document.documentElement.hasAttribute('data-motion')).toBe(false);
    expect(document.documentElement.classList.contains('prefers-reduced-motion')).toBe(false);
  });

  it('low latency sets data-latency', () => {
    setPreferences({ lowLatency: true });
    expect(document.documentElement.getAttribute('data-latency')).toBe('low');
    setPreferences({ lowLatency: false });
    expect(document.documentElement.hasAttribute('data-latency')).toBe(false);
  });

  it('turning GPU compositing off sets data-hwaccel (inverted flag)', () => {
    setPreferences({ hardwareAccel: false });
    expect(document.documentElement.getAttribute('data-hwaccel')).toBe('off');
    setPreferences({ hardwareAccel: true });
    expect(document.documentElement.hasAttribute('data-hwaccel')).toBe(false);
  });

  it('ambient effects off sets data-ambient', () => {
    setPreferences({ ambientEffects: false });
    expect(document.documentElement.getAttribute('data-ambient')).toBe('off');
  });

  it('persists to localStorage and rehydrates across a reload', () => {
    setPreferences({ reduceMotion: true, lowLatency: true });
    expect(getPreferences().reduceMotion).toBe(true);

    // Simulate a fresh page load: attributes gone, then hydrate from storage.
    document.documentElement.removeAttribute('data-motion');
    document.documentElement.removeAttribute('data-latency');
    hydratePreferences();

    expect(getPreferences().reduceMotion).toBe(true);
    expect(getPreferences().lowLatency).toBe(true);
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
    expect(document.documentElement.getAttribute('data-latency')).toBe('low');
  });

  it('ignores junk values instead of breaking the app', () => {
    localStorage.setItem('chazter:prefs', '{"reduceMotion":"yes","bogus":1}');
    expect(() => hydratePreferences()).not.toThrow();
    expect(getPreferences().reduceMotion).toBe(false);

    localStorage.setItem('chazter:prefs', 'not json at all');
    expect(() => hydratePreferences()).not.toThrow();
  });

  it('resets every switch at once', () => {
    setPreferences({ reduceMotion: true, lowLatency: true, hardwareAccel: false });
    resetPreferences();
    expect(getPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(document.documentElement.hasAttribute('data-latency')).toBe(false);
    expect(document.documentElement.hasAttribute('data-hwaccel')).toBe(false);
  });

  it('notifies subscribers so the UI re-renders on change', () => {
    const seen = [];
    const unsubscribe = subscribePreferences(() => seen.push({ ...getPreferences() }));

    setPreferences({ reduceMotion: true });
    setPreferences({ lowLatency: true });

    expect(seen).toHaveLength(2);
    expect(seen[1]).toMatchObject({ reduceMotion: true, lowLatency: true });

    unsubscribe();
    setPreferences({ reduceMotion: false });
    expect(seen).toHaveLength(2);
  });
});
