import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * Route coverage.
 *
 * Every route is mounted with deliberately minimal data (no conversations, no
 * messages, a profile with the fewest fields a real document can have). The
 * goal is to catch render-time crashes that richer fixtures hide — a screen
 * that only works when data happens to be complete is a bug.
 */

const { fixture, authState } = vi.hoisted(() => ({
  fixture: { profile: null, conversations: [], messages: [], typing: [], receipts: {} },
  authState: { user: null },
}));

vi.mock('../lib/firebase/firebase.js', () => ({ auth: { currentUser: null }, db: {}, storage: {}, firebaseApp: {} }));

const noopUnsub = () => {};

vi.mock('../lib/services/userService.js', () => ({
  subscribeUserProfile: (_uid, onData) => {
    onData(fixture.profile);
    return noopUnsub;
  },
  startPresenceHeartbeat: () => noopUnsub,
  stopPresenceHeartbeat: () => {},
  setPresence: () => Promise.resolve(),
  createUserProfile: vi.fn(),
  isUsernameAvailable: vi.fn(() => Promise.resolve({ available: true, reason: '' })),
  updateUserProfile: vi.fn(),
  searchUsers: vi.fn(() => Promise.resolve([])),
  getUserProfile: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../lib/services/conversationService.js', () => {
  const ok = () => Promise.resolve();
  return {
    subscribeConversations: (_uid, onData) => {
      onData(fixture.conversations, { fromCache: false });
      return noopUnsub;
    },
    subscribeConversation: (_id, _uid, onData) => {
      onData(fixture.conversations[0] || null);
      return noopUnsub;
    },
    subscribeReadCursors: (_id, onData) => {
      onData(fixture.receipts);
      return noopUnsub;
    },
    subscribeTyping: (_id, _uid, onData) => {
      onData(fixture.typing);
      return noopUnsub;
    },
    normaliseConversation: (conversation) => conversation,
    updateReadCursor: ok,
    setTyping: ok,
    clearTyping: ok,
    markConversationRead: ok,
    startPrivateConversation: ok,
    createGroupConversation: ok,
    addGroupMembers: ok,
    removeMember: ok,
    leaveConversation: ok,
    updateGroupInfo: ok,
    setMuted: ok,
    setArchived: ok,
    promoteToAdmin: ok,
    getConversation: () => Promise.resolve(null),
    searchMessages: () => Promise.resolve([]),
    searchAllMessages: () => Promise.resolve([]),
    findUserByUsername: () => Promise.resolve(null),
  };
});

vi.mock('../lib/services/messageService.js', () => ({
  subscribeMessages: (_id, handlers) => {
    handlers.onData(fixture.messages, { hasMore: false });
    return noopUnsub;
  },
  fetchOlderMessages: vi.fn(() => Promise.resolve([])),
  sendMessage: vi.fn(),
  deleteMessage: vi.fn(),
}));

vi.mock('../lib/services/storageService.js', () => ({
  MAX_IMAGE_BYTES: 5 * 1024 * 1024,
  ACCEPTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
  validateImageFile: vi.fn(() => null),
  readImageDimensions: vi.fn(() => Promise.resolve({ width: 1, height: 1 })),
  uploadChatImage: vi.fn(() => Promise.resolve({ url: '', storagePath: '' })),
  uploadAvatar: vi.fn(() => Promise.resolve({ url: '' })),
  removeStoredImage: vi.fn(() => Promise.resolve()),
}));

vi.mock('../lib/hooks/useTyping', () => ({}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_auth, callback) => {
    setTimeout(() => callback(authState.user), 0);
    return noopUnsub;
  },
  GoogleAuthProvider: class {
    setCustomParameters() {}
    static credentialFromError() {
      return null;
    }
  },
  EmailAuthProvider: { credential: () => ({}) },
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
  linkWithCredential: vi.fn(),
  linkWithPopup: vi.fn(),
  fetchSignInMethodsForEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
}));

const { App } = await import('../App.jsx');

function signedIn() {
  authState.user = { uid: 'u1', email: 'a@example.com', displayName: 'Ada', providerData: [] };
  fixture.profile = {
    id: 'u1',
    uid: 'u1',
    username: 'ada',
    usernameLower: 'ada',
    displayName: 'Ada',
    email: 'a@example.com',
    photoURL: '',
    bio: '',
    onboardingComplete: true,
    presence: { state: 'online', lastActiveAt: new Date() },
    createdAt: new Date(),
  };
}

beforeEach(() => {
  authState.user = null;
  fixture.profile = null;
  fixture.conversations = [];
  fixture.messages = [];
  fixture.typing = [];
  fixture.receipts = {};
});

const ROUTES = ['/app', '/app/people', '/app/settings/profile', '/app/settings/appearance', '/app/settings/account', '/app/c/does-not-exist', '/welcome', '/signin', '/signup', '/forgot-password', '/404'];

describe.each(ROUTES)('route %s', (route) => {
  it('mounts without hitting the error boundary', async () => {
    signedIn();
    window.history.pushState({}, '', route);
    render(<App />);

    // Wait for the auth resolution tick.
    await waitFor(() => {
      expect(screen.queryByText(/Something slipped/i)).toBeNull();
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(screen.queryByText(/Something slipped/i)).toBeNull();
  });
});
