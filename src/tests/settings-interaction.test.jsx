import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PerformanceSettings } from '../components/settings/PerformanceSettings.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { getPreferences, resetPreferences } from '../lib/preferences.js';

/**
 * The original "Reduce motion" switch rendered perfectly and did nothing:
 *
 *   <Switch checked={false} onChange={() => {}} />
 *
 * A screenshot test would have passed. These tests click the switch and then
 * assert on the DOM, which is the only thing that proves the control works.
 */
function renderPanel() {
  return render(
    <ToastProvider>
      <PerformanceSettings />
    </ToastProvider>,
  );
}

describe('Performance settings actually work', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    resetPreferences();
  });

  it('turning Reduce motion on changes the document, not just the switch', () => {
    renderPanel();
    const toggle = screen.getByRole('switch', { name: /reduce motion in chazter/i });

    expect(toggle).not.toBeChecked();
    expect(document.documentElement.hasAttribute('data-motion')).toBe(false);

    fireEvent.click(toggle);

    expect(toggle).toBeChecked();
    expect(getPreferences().reduceMotion).toBe(true);
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
  });

  it('turning Low latency on sets the attribute the CSS depends on', () => {
    renderPanel();
    const toggle = screen.getByRole('switch', { name: /low latency profile/i });

    fireEvent.click(toggle);

    expect(toggle).toBeChecked();
    expect(document.documentElement.getAttribute('data-latency')).toBe('low');
  });

  it('turning GPU compositing off sets data-hwaccel="off"', () => {
    renderPanel();
    const toggle = screen.getByRole('switch', { name: /use gpu compositing/i });

    // On by default.
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(document.documentElement.getAttribute('data-hwaccel')).toBe('off');
  });

  it('turning the ambient background off sets data-ambient="off"', () => {
    renderPanel();
    const toggle = screen.getByRole('switch', { name: /animated background/i });
    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute('data-ambient')).toBe('off');
  });

  it('each switch toggles back off again', () => {
    renderPanel();
    const toggle = screen.getByRole('switch', { name: /low latency profile/i });

    fireEvent.click(toggle);
    expect(document.documentElement.hasAttribute('data-latency')).toBe(true);

    fireEvent.click(toggle);
    expect(document.documentElement.hasAttribute('data-latency')).toBe(false);
  });

  it('survives a reload — the choice is persisted', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('switch', { name: /reduce motion in chazter/i }));
    expect(JSON.parse(localStorage.getItem('chazter:prefs')).reduceMotion).toBe(true);
  });

  it('Reset to defaults clears every switch', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('switch', { name: /low latency profile/i }));
    fireEvent.click(screen.getByRole('switch', { name: /use gpu compositing/i }));

    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));

    expect(getPreferences().lowLatency).toBe(false);
    expect(getPreferences().hardwareAccel).toBe(true);
    expect(document.documentElement.hasAttribute('data-latency')).toBe(false);
    expect(document.documentElement.hasAttribute('data-hwaccel')).toBe(false);
  });
});
