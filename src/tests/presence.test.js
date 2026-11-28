import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Presence heartbeat.
 *
 * Regression: `startPresenceHeartbeat` stored its visibility listener on the
 * value returned by `setInterval`. In browsers that is a NUMBER, so the
 * assignment threw `Cannot create property 'onVisibility' on number '14'`
 * *during React render* (the effect that starts the heartbeat runs on mount),
 * which tripped the error boundary and made the whole app unusable for every
 * signed-in user.
 *
 * The bug survived because every render test mocked `startPresenceHeartbeat`
 * out. These tests use the real module with a mocked Firestore.
 */

const updateDocMock = vi.fn(() => Promise.resolve());

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'profile-ref' })),
  updateDoc: (...args) => updateDocMock(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  collection: vi.fn(() => ({})),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  onSnapshot: vi.fn(() => () => {}),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  startAt: vi.fn(() => ({})),
  endAt: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  writeBatch: vi.fn(() => ({ delete: vi.fn(), set: vi.fn(), update: vi.fn(), commit: vi.fn(() => Promise.resolve()) })),
  runTransaction: vi.fn(),
  Timestamp: { now: vi.fn(() => 'NOW') },
  documentId: vi.fn(() => '__name__'),
}));

vi.mock('../lib/firebase/firebase.js', () => ({ auth: {}, db: {}, storage: {}, firebaseApp: {} }));

const { startPresenceHeartbeat, stopPresenceHeartbeat, setPresence } = await import(
  '../lib/services/userService.js'
);

beforeEach(() => {
  updateDocMock.mockClear();
  stopPresenceHeartbeat();
});

afterEach(() => {
  stopPresenceHeartbeat();
  vi.useRealTimers();
});

describe('presence heartbeat', () => {
  it('starts without throwing', () => {
    // The original bug threw right here, inside a React effect.
    expect(() => startPresenceHeartbeat('u1')).not.toThrow();
  });

  it('never writes properties onto the interval handle', () => {
    // The original bug assigned `heartbeatTimer.onVisibility = fn`. Whether
    // setInterval returns a number (browsers) or an object (Node), the real
    // invariant is that we must not mutate the handle at all.
    const realSetInterval = globalThis.setInterval;
    let handle;
    globalThis.setInterval = (...args) => {
      handle = realSetInterval(...args);
      return handle;
    };
    try {
      startPresenceHeartbeat('u1');
      // A numeric handle cannot carry properties; if it is an object, it must
      // still be left untouched by our code.
      if (typeof handle === 'object') {
        expect(Object.keys(handle)).not.toContain('onVisibility');
      }
      expect(handle).toBeDefined();
    } finally {
      globalThis.setInterval = realSetInterval;
      stopPresenceHeartbeat();
    }
  });

  it('stops cleanly and is idempotent', () => {
    startPresenceHeartbeat('u1');
    expect(() => stopPresenceHeartbeat()).not.toThrow();
    expect(() => stopPresenceHeartbeat()).not.toThrow();
  });

  it('removes its visibilitychange listener on stop', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    startPresenceHeartbeat('u1');
    const added = addSpy.mock.calls.find(([type]) => type === 'visibilitychange');
    expect(added, 'no visibilitychange listener registered').toBeTruthy();

    stopPresenceHeartbeat();
    const removed = removeSpy.mock.calls.find(([type]) => type === 'visibilitychange');
    expect(removed, 'listener was not removed — this is a leak').toBeTruthy();
    // The exact handler must be unregistered, not a different one.
    expect(removed[1]).toBe(added[1]);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('restarting does not accumulate listeners', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    startPresenceHeartbeat('u1');
    startPresenceHeartbeat('u1');
    startPresenceHeartbeat('u1');

    const addedCount = addSpy.mock.calls.filter(([type]) => type === 'visibilitychange').length;
    const removedCount = removeSpy.mock.calls.filter(([type]) => type === 'visibilitychange').length;
    // Every restart except the last should have torn down its predecessor.
    expect(addedCount - removedCount).toBe(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('writes presence through setPresence without throwing', async () => {
    await expect(setPresence('u1', 'offline')).resolves.toBeUndefined();
    expect(updateDocMock).toHaveBeenCalled();
  });
});
