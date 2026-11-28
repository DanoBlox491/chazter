import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom lacks these browser APIs that our components touch.
// It also has no layout engine, so pick a sensible default viewport: desktop.
// Individual tests can override window.matchMedia to exercise mobile layouts.
if (!window.matchMedia || !window.matchMedia.__chazterPatched) {
  const matchMedia = (query) => ({
    matches: /min-width/.test(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
  matchMedia.__chazterPatched = true;
  window.matchMedia = matchMedia;
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  cleanup();
});

// Silence noisy expected logs in tests but keep failures visible.
vi.spyOn(console, 'warn').mockImplementation(() => {});
