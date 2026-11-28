/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'chazter:theme';
const ThemeContext = createContext(null);

function readStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* ignore */
  }
  return 'system';
}

function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  const resolved = theme === 'system' ? systemTheme() : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#F6F4EE' : '#0B0F0E');
  return resolved;
}

/**
 * Theme provider with three-way preference (light / dark / system).
 * The choice is stored locally so it survives sign-out and reloads, and the
 * inline script in index.html applies it before first paint.
 */
export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readStoredPreference);
  const [resolved, setResolved] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme
      : systemTheme(),
  );

  useEffect(() => {
    setResolved(applyTheme(preference));
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* storage may be unavailable */
    }
  }, [preference]);

  // Track OS changes while following the system.
  useEffect(() => {
    if (preference !== 'system' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setResolved(applyTheme('system'));
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, [preference]);

  const setTheme = useCallback((next) => {
    setPreference(['light', 'dark', 'system'].includes(next) ? next : 'system');
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference((current) => {
      const base = current === 'system' ? systemTheme() : current;
      return base === 'light' ? 'dark' : 'light';
    });
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, isDark: resolved === 'dark', setTheme, toggleTheme }),
    [preference, resolved, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
