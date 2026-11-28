import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import JoinPage from '../pages/JoinPage.jsx';

/**
 * The invite flow is the part most likely to break silently: a link that
 * resolves but does not join, or a join that lands on the wrong screen, both
 * look like "the feature doesn't work" and neither throws an error.
 */

const { inviteState, joinResult } = vi.hoisted(() => ({
  inviteState: { invite: null, shouldThrow: null },
  joinResult: { value: null, shouldThrow: null },
}));

vi.mock('../lib/firebase/firebase.js', () => ({ auth: { currentUser: null }, db: {}, storage: {} }));

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { uid: 'u2', displayName: 'Bo', username: 'bo' },
    loading: false,
  }),
}));

vi.mock('../context/ToastContext.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('../lib/services/serverService.js', () => ({
  getInvite: () => {
    if (inviteState.shouldThrow) return Promise.reject(inviteState.shouldThrow);
    return Promise.resolve(inviteState.invite);
  },
  joinViaInvite: () => {
    if (joinResult.shouldThrow) return Promise.reject(joinResult.shouldThrow);
    return Promise.resolve(joinResult.value);
  },
}));

vi.mock('../lib/services/models.js', async (importOriginal) => {
  const actual = await importOriginal();
  return actual;
});

function renderJoin(code = 'abcdefghjk') {
  return render(
    <MemoryRouter initialEntries={[`/join/${code}`]}>
      <Routes>
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/app" element={<div>inbox</div>} />
        <Route path="/app/s/:serverId" element={<div>server</div>} />
        <Route path="/app/s/:serverId/c/:channelId" element={<div>server</div>} />
        <Route path="/app/c/:id" element={<div>group chat</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('invite link flow', () => {
  beforeEach(() => {
    inviteState.invite = null;
    inviteState.shouldThrow = null;
    joinResult.value = null;
    joinResult.shouldThrow = null;
  });

  it('shows a clear dead end for an invalid or revoked code', async () => {
    inviteState.invite = null; // revoked invites resolve to null
    renderJoin();

    expect(await screen.findByText(/isn’t valid/i)).toBeInTheDocument();
    // Crucial: it must not offer a Join button for a dead link.
    expect(screen.queryByRole('button', { name: /^join /i })).not.toBeInTheDocument();
  });

  it('names the target so people know what they are accepting', async () => {
    inviteState.invite = { type: 'server', targetId: 's1', targetName: 'Design Guild', revoked: false };
    renderJoin();

    expect(await screen.findByText(/Join Design Guild/i)).toBeInTheDocument();
    expect(screen.getByText(/added to every channel/i)).toBeInTheDocument();
  });

  it('joins a server and routes into its first channel', async () => {
    inviteState.invite = { type: 'server', targetId: 's1', targetName: 'Design Guild', revoked: false };
    joinResult.value = { serverId: 's1', channelId: 'c1', alreadyMember: false };
    renderJoin();

    fireEvent.click(await screen.findByRole('button', { name: /join server/i }));

    expect(await screen.findByText('server')).toBeInTheDocument();
  });

  it('joining a group lands in that group chat', async () => {
    inviteState.invite = { type: 'group', targetId: 'conv-1', targetName: 'Weekend Plans', revoked: false };
    joinResult.value = { conversationId: 'conv-1', alreadyMember: false };
    renderJoin();

    expect(await screen.findByText(/Join Weekend Plans/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /join group/i }));

    expect(await screen.findByText('group chat')).toBeInTheDocument();
  });

  it('re-joining an existing membership is not an error', async () => {
    inviteState.invite = { type: 'server', targetId: 's1', targetName: 'Design Guild', revoked: false };
    joinResult.value = { serverId: 's1', channelId: 'c1', alreadyMember: true };
    renderJoin();

    fireEvent.click(await screen.findByRole('button', { name: /join server/i }));

    // It still navigates in; being already a member is success, not failure.
    expect(await screen.findByText('server')).toBeInTheDocument();
  });

  it('surfaces a revoked-in-flight failure instead of pretending it worked', async () => {
    inviteState.invite = { type: 'server', targetId: 's1', targetName: 'Design Guild', revoked: false };
    joinResult.shouldThrow = Object.assign(new Error('This invite link is no longer valid.'), { code: 'invite-invalid' });
    renderJoin();

    fireEvent.click(await screen.findByRole('button', { name: /join server/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /join server/i })).toBeInTheDocument();
    });
    expect(screen.queryByText('server')).not.toBeInTheDocument();
  });
});
