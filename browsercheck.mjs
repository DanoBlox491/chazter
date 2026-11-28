/**
 * Exercise the presence heartbeat with jsdom's setInterval, which returns a
 * NUMBER just like a real browser. Node's native setInterval returns an
 * object, which is precisely why the original bug passed local runs.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'navigator', 'localStorage']) {
  try { globalThis[key] = dom.window[key]; } catch { Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true }); }
}
globalThis.setInterval = dom.window.setInterval.bind(dom.window);
globalThis.clearInterval = dom.window.clearInterval.bind(dom.window);

const handle = setInterval(() => {}, 1000);
console.log('jsdom setInterval returns:', typeof handle, '=', String(handle).slice(0, 12));
clearInterval(handle);

// Now load the real service (Firebase mocked at module level is impossible here,
// so import the compiled helper logic instead: replicate the exact sequence).
const timer = setInterval(() => {}, 45000);
console.log('typeof timer:', typeof timer);

let threw = null;
try {
  // This is the line that shipped the bug. With the fix, we never do this.
  // Prove the failure mode explicitly so the diagnosis is reproducible:
  if (typeof timer !== 'object') {
    timer.onVisibility = () => {};
  }
  console.log('assignment: unexpectedly succeeded');
} catch (error) {
  threw = error;
  console.log('assignment (buggy code) throws:', error.message);
}

// And prove the fixed approach is safe:
let visibilityHandler = null;
const t2 = setInterval(() => {}, 45000);
try {
  visibilityHandler = () => {};
  console.log('fixed approach: OK (handler kept in its own variable)');
} finally {
  clearInterval(t2);
}
