import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Smoke tests that mount the real app with Firebase mocked out.
 * These catch the failures unit tests can't: bad hooks, bad provider order,
 * broken routes, unlabelled controls.
 */

// --- Firebase mocks ---------------------------------------------------
// `vi.hoisted` lets the mock factories (which Vitest hoists to the top of the
// module) read fixtures defined below without a TDZ error.
const { workspaceFixture, authState } = vi.hoisted(() => ({
  workspaceFixture: { profile: null, conversations: [], messages: [], typing: [], receipts: {} },
  authState: { user: null },
}));

const authListeners = [];
vi.mock('../lib/firebase/firebase.js', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
  firebaseApp: {},
}));

vi.mock('../lib/services/userService.js', () => {
  return {
    subscribeUserProfile: (_uid, onData) => {
      onData(workspaceFixture.profile);
      return () => {};
    },
    startPresenceHeartbeat: () => () => {},
    stopPresenceHeartbeat: () => {},
    setPresence: () => Promise.resolve(),
    createUserProfile: vi.fn(),
    isUsernameAvailable: vi.fn(() => Promise.resolve({ available: true, reason: '' })),
    updateUserProfile: vi.fn(),
    searchUsers: vi.fn(() => Promise.resolve([])),
    getUserProfile: vi.fn(() => Promise.resolve(null)),
  };
});

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_auth, callback) => {
    authListeners.push(callback);
    // Fake Firebase resolving its auth state on the next tick.
    setTimeout(() => callback(authState.user), 0);
    return () => {};
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
  linkWithPopup: vi.fn(),
  linkWithCredential: vi.fn(),
  sendEmailVerification: vi.fn(() => Promise.resolve()),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
  fetchSignInMethodsForEmail: vi.fn(() => Promise.resolve([])),
  updateProfile: vi.fn(),
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('../lib/services/conversationService.js', () => ({
  subscribeConversations: (_uid, onData) => {
    onData(workspaceFixture.conversations, { fromCache: false });
    return () => {};
  },
  subscribeConversation: () => () => {},
  normaliseConversation: (conversation) => conversation,
  startPrivateConversation: vi.fn(),
  createGroupConversation: vi.fn(),
  addGroupMembers: vi.fn(() => Promise.resolve()),
  removeMember: vi.fn(() => Promise.resolve()),
  leaveConversation: vi.fn(() => Promise.resolve()),
  updateGroupInfo: vi.fn(() => Promise.resolve()),
  setMuted: vi.fn(() => Promise.resolve()),
  setArchived: vi.fn(() => Promise.resolve()),
  promoteToAdmin: vi.fn(() => Promise.resolve()),
  updateReadCursor: vi.fn(() => Promise.resolve()),
  getConversation: vi.fn(() => Promise.resolve(null)),
  searchMessages: vi.fn(() => Promise.resolve([])),
  searchAllMessages: vi.fn(() => Promise.resolve([])),
  findUserByUsername: vi.fn(() => Promise.resolve(null)),
  markConversationRead: () => Promise.resolve(),
  setTyping: vi.fn(),
  clearTyping: vi.fn(),
  subscribeTyping: (_id, _uid, onData) => {
    onData(workspaceFixture.typing);
    return () => {};
  },
  subscribeReadCursors: (_id, onData) => {
    onData(workspaceFixture.receipts);
    return () => {};
  },
}));

vi.mock('../lib/services/messageService.js', () => ({
  subscribeMessages: (_id, { onData }) => {
    onData(workspaceFixture.messages, { fromCache: false, hasMore: false });
    return () => {};
  },
  fetchOlderMessages: vi.fn(() => Promise.resolve([])),
  sendMessage: vi.fn(),
  deleteMessage: vi.fn(),
}));

const { App } = await import('../App.jsx');

function signedIn() {
  authState.user = { uid: 'u1', email: 'ada@example.com', displayName: 'Ada Lovelace', providerData: [] };
  workspaceFixture.profile = {
    id: 'u1',
    uid: 'u1',
    username: 'ada',
    usernameLower: 'ada',
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    photoURL: '',
    bio: 'Making things.',
    onboardingComplete: true,
    presence: { state: 'online', lastActiveAt: new Date() },
    createdAt: new Date('2026-01-10'),
  };
}

beforeEach(() => {
  authState.user = null;
  workspaceFixture.profile = null;
  workspaceFixture.conversations = [];
  workspaceFixture.messages = [];
  workspaceFixture.typing = [];
  window.history.pushState({}, '', '/');
});

const conversation = {
  id: 'u1__u2',
  type: 'private',
  memberIds: ['u1', 'u2'],
  members: {
    u1: { displayName: 'Ada Lovelace', username: 'ada' },
    u2: { displayName: 'Ravi Shah', username: 'ravi' },
  },
  lastMessage: { text: 'See you Thursday', senderId: 'u2', createdAt: new Date() },
  lastMessageAt: new Date(),
  unreadCounts: { u1: 2, u2: 0 },
  unreadCount: 2,
  typingUsers: [],
  admins: ['u1', 'u2'],
};

describe('public pages', () => {
  it('renders the landing page with working navigation', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /conversations,\s*considered/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /get started/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /sign in/i }).length).toBeGreaterThan(0);
  });

  it('renders the sign-in form with labelled inputs', async () => {
    window.history.pushState({}, '', '/signin');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /pick up where you left off/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('validates an empty sign-in without calling Firebase', async () => {
    window.history.pushState({}, '', '/signin');
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: /pick up where you left off/i });
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText(/enter your email address/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
  });

  it('renders the sign-up form with validation affordances', async () => {
    window.history.pushState({}, '', '/signup');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /start a better conversation/i })).toBeInTheDocument();
    for (const label of [/^full name/i, /^username/i, /^email/i, /^password/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('rejects an invalid email on the reset page', async () => {
    window.history.pushState({}, '', '/forgot-password');
    render(<App />);
    const user = userEvent.setup();
    const email = await screen.findByLabelText(/email/i);
    await user.type(email, 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(/looks incomplete/i)).toBeInTheDocument();
  });

  it('shows a branded 404 for unknown routes', async () => {
    window.history.pushState({}, '', '/nope');
    render(<App />);
    expect(await screen.findByText(/this page took a wrong turn/i)).toBeInTheDocument();
  });

  it('redirects protected routes to sign-in when signed out', async () => {
    window.history.pushState({}, '', '/app');
    render(<App />);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/signin');
    });
  });
});

describe('onboarding', () => {
  it('renders the profile setup screen for a signed-in user with no profile', async () => {
    authState.user = {
      uid: 'u9',
      email: 'newcomer@example.com',
      displayName: 'New Comer',
      photoURL: '',
      providerData: [{ providerId: 'google.com', displayName: 'New Comer', photoURL: '' }],
    };
    workspaceFixture.profile = null;
    window.history.pushState({}, '', '/welcome');
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await screen.findByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enter chazter/i })).toBeInTheDocument();
  });
});

describe('signed-in workspace', () => {
  it('renders the inbox with conversations, unread badge and nav', async () => {
    signedIn();
    workspaceFixture.conversations = [conversation];
    window.history.pushState({}, '', '/app');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /^chats$/i })).toBeInTheDocument();
    expect(screen.getAllByText('Ravi Shah').length).toBeGreaterThan(0);
    expect(screen.getByText('See you Thursday')).toBeInTheDocument();
    // Unread badge is exposed to assistive tech with a count.
    expect(screen.getAllByLabelText(/2 unread messages/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: /^main navigation$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^chats/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /find people/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /your account menu/i })).toBeInTheDocument();
  });

  it('renders the empty inbox for a brand-new account', async () => {
    // Regression: a user who has just completed onboarding has zero
    // conversations. This state must render the empty state, not throw.
    signedIn();
    workspaceFixture.conversations = [];
    workspaceFixture.messages = [];
    window.history.pushState({}, '', '/app');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /^chats$/i })).toBeInTheDocument();
    expect(await screen.findByText(/fresh page/i)).toBeInTheDocument();
  });

  it('opens a conversation and renders messages, ticks and composer', async () => {
    signedIn();
    workspaceFixture.conversations = [conversation];
    workspaceFixture.messages = [
      {
        id: 'm1',
        type: 'text',
        text: 'Still good for Thursday?',
        senderId: 'u2',
        senderName: 'Ravi Shah',
        createdAt: { toMillis: () => Date.now() - 60000 },
      },
      {
        id: 'm2',
        type: 'text',
        text: 'Yes — I booked the studio.',
        senderId: 'u1',
        senderName: 'Ada Lovelace',
        createdAt: { toMillis: () => Date.now() - 1000 },
      },
    ];
    workspaceFixture.receipts = { u2: Date.now() };
    window.history.pushState({}, '', '/app/c/u1__u2');
    render(<App />);

    expect(await screen.findByText('Still good for Thursday?')).toBeInTheDocument();
    expect(screen.getByText('Yes — I booked the studio.')).toBeInTheDocument();
    // The sender's message carries a "Read" receipt (Ravi's cursor passed it).
    expect(screen.getAllByText(/^read$/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^message$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^conversation details$/i })).toBeInTheDocument();
  });

  it('shows a typing indicator in the header', async () => {
    signedIn();
    workspaceFixture.conversations = [conversation];
    workspaceFixture.messages = [
      {
        id: 'm1',
        type: 'text',
        text: 'Hello',
        senderId: 'u1',
        senderName: 'Ada Lovelace',
        createdAt: { toMillis: () => Date.now() },
      },
    ];
    workspaceFixture.typing = ['Ravi Shah'];
    window.history.pushState({}, '', '/app/c/u1__u2');
    render(<App />);
    expect((await screen.findAllByText(/Ravi Shah is typing/i)).length).toBeGreaterThan(0);
  });

  it('renders settings for the signed-in user and switches tabs', async () => {
    signedIn();
    window.history.pushState({}, '', '/app/settings');
    render(<App />);
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: /your profile/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /appearance/i }));
    expect(await screen.findByRole('heading', { name: /^appearance$/i })).toBeInTheDocument();
    const tiles = screen.getAllByRole('button', { pressed: false });
    expect(tiles.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /account & security/i }));
    expect(await screen.findByRole('heading', { name: /account & security/i })).toBeInTheDocument();
    expect(screen.getByText(/sign-in methods/i)).toBeInTheDocument();
  });

  it('greets a user with an empty inbox and real actions', async () => {
    signedIn();
    window.history.pushState({}, '', '/app');
    render(<App />);
    expect(await screen.findByText(/your inbox is a fresh page/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /new conversation/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /create a group/i })).toBeInTheDocument();
  });
});
