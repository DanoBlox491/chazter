/**
 * Local preferences that change how the app runs on this device.
 *
 * These are intentionally **local**, not synced to Firestore: they describe
 * the machine and the person's comfort, not their identity. A phone and a
 * desktop want different answers, and a preference that follows you onto a
 * slow laptop is a bug.
 *
 * Every key here maps to something real (`data-` attributes on <html>), never
 * to a decorative toggle:
 *
 *   reduceMotion      → data-motion="reduced"      (all animations off)
 *   lowLatency        → data-latency="low"         (no blur, no shadows,
 *                                                     instant transitions)
 *   hardwareAccel     → data-hwaccel="off"         (GPU-composited effects
 *                                                     disabled — the real fix
 *                                                     for devices where the
 *                                                     compositor misbehaves)
 *   instantLaunch     → localStorage-backed boot   (render from cache first)
 *   ambientEffects    → data-ambient="off"         (animated background off)
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'chazter:prefs';

/**
 * Defaults are chosen so that nothing changes for people who never open
 * settings, and so that the *OS* is respected before the app has an opinion.
 */
export const DEFAULT_PREFERENCES = {
  reduceMotion: false,
  lowLatency: false,
  hardwareAccel: true,
  instantLaunch: true,
  ambientEffects: true,
};

const TOGGLES = {
  /**
   * `inverted` describes a switch whose *off* state is the one worth marking
   * on <html>: GPU compositing off, ambient effects off. Everything else
   * marks its on state. Getting this backwards silently disables a setting —
   * which is exactly what the preferences tests caught.
   */
  reduceMotion: { attribute: 'data-motion', inverted: false, value: 'reduced' },
  lowLatency: { attribute: 'data-latency', inverted: false, value: 'low' },
  hardwareAccel: { attribute: 'data-hwaccel', inverted: true, value: 'off' },
  instantLaunch: { attribute: 'data-launch', inverted: false, value: 'instant' },
  ambientEffects: { attribute: 'data-ambient', inverted: true, value: 'off' },
};

let state = { ...DEFAULT_PREFERENCES };
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const next = { ...DEFAULT_PREFERENCES };
    for (const key of Object.keys(DEFAULT_PREFERENCES)) {
      if (typeof parsed[key] === 'boolean') next[key] = parsed[key];
    }
    return next;
  } catch {
    return null;
  }
}

/**
 * Project preferences onto <html> as attributes.
 *
 * Doing this centrally means no component has to know about CSS variables or
 * class names, and a change is visible immediately in the same tick.
 */
export function applyPreferences(prefs = state) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [key, rule] of Object.entries(TOGGLES)) {
    const on = Boolean(prefs[key]);
    const shouldSet = rule.inverted ? !on : on;
    if (shouldSet) root.setAttribute(rule.attribute, rule.value);
    else root.removeAttribute(rule.attribute);
  }
  // A single class is easier for third-party CSS / debugging to spot.
  root.classList.toggle('prefers-reduced-motion', Boolean(prefs.reduceMotion));
}

export function getPreferences() {
  return state;
}

export function setPreferences(patch) {
  const next = { ...state };
  for (const [key, value] of Object.entries(patch || {})) {
    if (key in DEFAULT_PREFERENCES && typeof value === 'boolean') next[key] = value;
  }
  state = next;
  applyPreferences(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode — the preference still applies for this session */
  }
  for (const listener of listeners) listener();
  return state;
}

export function resetPreferences() {
  return setPreferences(DEFAULT_PREFERENCES);
}

export function subscribePreferences(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Load saved preferences once, before React renders. */
export function hydratePreferences() {
  const stored = read();
  if (stored) state = stored;
  applyPreferences(state);
  return state;
}

/** React binding — re-renders only when a preference actually changes. */
export function usePreferences() {
  const prefs = useSyncExternalStore(subscribePreferences, getPreferences, getPreferences);
  return {
    ...prefs,
    set: setPreferences,
    reset: resetPreferences,
    toggle: (key) => setPreferences({ [key]: !prefs[key] }),
  };
}

/**
 * Whether motion should be suppressed right now.
 *
 * The person's explicit choice wins in both directions: turning `reduceMotion`
 * on suppresses motion even when the OS allows it, and the OS setting is
 * honoured when they have not chosen otherwise.
 */
export function prefersReducedMotion(prefs = state) {
  if (prefs.reduceMotion) return true;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
