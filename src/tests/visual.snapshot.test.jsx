import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Structural "visual" checks.
 *
 * There is no browser in CI here, so instead of screenshots we assert the
 * rendered structure that the CSS depends on: the classes, nesting and
 * element roles that make the layout work. If a refactor breaks a selector,
 * these fail before a user ever sees a broken screen.
 */

vi.mock('firebase/auth', () => ({}));
vi.mock('../lib/firebase/firebase.js', () => ({ auth: {}, db: {}, storage: {} }));

const { ThemeProvider } = await import('../context/ThemeContext.jsx');
const { ToastProvider } = await import('../context/ToastContext.jsx');
const { Avatar, GroupAvatar } = await import('../components/ui/Avatar.jsx');
const { Button } = await import('../components/ui/Button.jsx');
const { Field } = await import('../components/ui/Field.jsx');
const { MessageBubble, DayDivider, TypingBubble } = await import('../components/chat/MessageBubble.jsx');
const { Composer } = await import('../components/chat/Composer.jsx');
const { ConversationRow } = await import('../components/chat/ConversationRow.jsx');
const { BrandMark, BrandLockup } = await import('../components/brand/Brand.jsx');
const { EmptyState } = await import('../components/ui/States.jsx');
const { Badge } = await import('../components/ui/Misc.jsx');

function wrap(ui) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('brand', () => {
  it('renders an accessible logo mark and lockup', () => {
    const { container } = render(<BrandLockup size={30} showTagline />);
    expect(container.querySelector('svg[aria-label="Chazter"]')).toBeTruthy();
    expect(container.textContent).toContain('Chazter');
    expect(container.textContent).toContain('conversations, considered');
  });

  it('mark uses themeable tokens, not hard-coded brand hexes in markup', () => {
    const { container } = render(<BrandMark />);
    expect(container.querySelector('.brand-mark__tile')).toBeTruthy();
    expect(container.innerHTML).toContain('var(--chat-jade)');
  });
});

describe('avatar', () => {
  it('derives a stable monogram and colour from the name', () => {
    const { container } = render(<Avatar name="Ada Lovelace" userId="u1" size={44} />);
    const avatar = container.querySelector('.avatar');
    expect(avatar.classList[1]).toMatch(/^avatar--(jade|coral|plum|amber|sky|clay)$/);
    expect(avatar.textContent).toBe('AL');
    expect(avatar.getAttribute('style')).toContain('--avatar-size: 44px');
  });

  it('renders presence dots with an accessible label', () => {
    const { getByRole } = render(<Avatar name="Ravi Shah" showStatus online />);
    expect(getByRole('img', { name: /online/i })).toBeTruthy();
  });

  it('renders a photo with a safe referrer policy when src is provided', () => {
    const { container } = render(<Avatar name="X" src="https://example.com/a.png" />);
    const img = container.querySelector('img');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('renders a group cluster for small groups', () => {
    const { container } = render(
      <GroupAvatar
        conversation={{
          name: 'Crew',
          memberIds: ['a', 'b'],
          members: { a: { displayName: 'A A' }, b: { displayName: 'B B' } },
        }}
        size={44}
      />,
    );
    expect(container.querySelector('.avatar-cluster')).toBeTruthy();
    expect(container.querySelectorAll('.avatar').length).toBe(2);
  });
});

describe('messaging visuals', () => {
  const baseMessage = {
    id: 'm1',
    type: 'text',
    text: 'Hello there',
    senderId: 'u2',
    senderName: 'Ravi Shah',
    createdAt: { toMillis: () => Date.now() },
  };

  it('renders an incoming bubble with time but no ticks', () => {
    const { container } = render(
      <MessageBubble message={baseMessage} isOwn={false} showAvatar showSender groupSize={2} cursors={{}} conversationType="private" />,
    );
    const bubble = container.querySelector('.msg__bubble');
    expect(bubble).toBeTruthy();
    expect(container.textContent).toContain('Hello there');
    expect(container.querySelector('.msg__ticks')).toBeNull();
    expect(container.querySelector('.msg--in')).toBeTruthy();
  });

  it('renders outgoing ticks in read state when cursors passed', () => {
    const message = { ...baseMessage, senderId: 'u1', createdAt: { toMillis: () => 1000 } };
    const { container } = render(
      <MessageBubble
        message={message}
        isOwn
        showAvatar
        groupSize={2}
        cursors={{ u2: 2000 }}
        conversationType="private"
      />,
    );
    expect(container.querySelector('.msg--out')).toBeTruthy();
    expect(container.querySelector('.msg__ticks.is-all-read')).toBeTruthy();
    expect(container.textContent).toContain('Read');
  });

  it('renders a pending clock state for optimistic messages', () => {
    const { container } = render(
      <MessageBubble
        message={{ ...baseMessage, senderId: 'u1', pending: true }}
        isOwn
        showAvatar
        groupSize={2}
        cursors={{}}
        conversationType="private"
      />,
    );
    expect(container.querySelector('.msg__ticks.is-pending')).toBeTruthy();
  });

  it('renders deleted messages as a tombstone without text', () => {
    const { container } = render(
      <MessageBubble
        message={{ ...baseMessage, text: '', deletedAt: new Date(), deletedBy: 'u2' }}
        isOwn={false}
        showAvatar
        groupSize={2}
        cursors={{}}
        conversationType="private"
      />,
    );
    expect(container.textContent).toContain('This message was deleted');
    expect(container.querySelector('.msg--deleted')).toBeTruthy();
  });

  it('renders an image message with an accessible open button', () => {
    const message = {
      ...baseMessage,
      type: 'image',
      text: '',
      image: { url: 'https://example.com/a.jpg', width: 800, height: 600 },
    };
    const { getByRole, container } = render(
      <MessageBubble message={message} isOwn={false} showAvatar groupSize={2} cursors={{}} conversationType="private" />,
    );
    const btn = getByRole('button', { name: /open photo/i });
    const img = container.querySelector('.msg__image');
    expect(btn).toBeTruthy();
    expect(img.getAttribute('style')).toContain('aspect-ratio: 800 / 600');
  });

  it('renders day dividers and typing rows with live regions', () => {
    const { container, getByText } = render(<DayDivider label="Yesterday" />);
    expect(container.querySelector('.day-divider')).toBeTruthy();
    expect(getByText('Yesterday')).toBeTruthy();

    const typing = render(<TypingBubble names={['Ravi Shah']} />);
    expect(typing.container.querySelector('[aria-live="polite"]')).toBeTruthy();
    expect(typing.getByText(/Ravi Shah is typing/)).toBeTruthy();
  });

  it('renders the composer with an accessible message field and send button', () => {
    const { getByLabelText, getByRole, container } = render(wrap(<Composer conversationId="c1" onSend={() => {}} drafts={new Map()} />));
    expect(getByLabelText(/^message$/i)).toBeTruthy();
    expect(getByRole('button', { name: /send message/i })).toBeDisabled();
    expect(getByRole('button', { name: /attach a photo/i })).toBeTruthy();
    expect(getByRole('button', { name: /insert emoji/i })).toBeTruthy();
    expect(container.querySelector('.composer')).toBeTruthy();
  });
});

describe('inbox row', () => {
  const conversation = {
    id: 'u1__u2',
    type: 'private',
    memberIds: ['u1', 'u2'],
    members: { u1: { displayName: 'Ada' }, u2: { displayName: 'Ravi Shah', username: 'ravi' } },
    lastMessage: { text: 'See you Thursday', senderId: 'u2' },
    lastMessageAt: new Date(),
    unreadCount: 3,
    typingUsers: [],
    muted: false,
  };

  it('renders name, preview, timestamp and unread badge', () => {
    const { container, getByLabelText } = render(
      <ConversationRow conversation={conversation} uid="u1" active onSelect={() => {}} />,
    );
    expect(container.textContent).toContain('Ravi Shah');
    expect(container.textContent).toContain('See you Thursday');
    expect(getByLabelText(/3 unread messages/i)).toBeTruthy();
    expect(container.querySelector('.conv-row.is-active')).toBeTruthy();
    expect(container.querySelector('.conv-row__time')).toBeTruthy();
  });

  it('shows a typing preview instead of the last message', () => {
    const { container } = render(
      <ConversationRow
        conversation={{ ...conversation, typingUsers: [{ uid: 'u2', name: 'Ravi' }] }}
        uid="u1"
        onSelect={() => {}}
      />,
    );
    expect(container.textContent).toMatch(/typing/i);
    expect(container.querySelector('.conv-row__preview.is-typing')).toBeTruthy();
  });
});

describe('primitives', () => {
  it('buttons expose variant classes and loading state', () => {
    const { getByRole, container } = render(<Button loading>Saving</Button>);
    const btn = getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.btn__spinner')).toBeTruthy();
  });

  it('fields wire label, hint, error and aria-invalid', () => {
    const { getByLabelText, getByRole } = render(
      <Field label="Email" hint="We never share it" error="Bad email" value="" onChange={() => {}} />,
    );
    const input = getByLabelText(/email/i);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(getByRole('alert').textContent).toMatch(/bad email/i);
    expect(input.getAttribute('aria-describedby')).toContain('error');
  });

  it('badges cap at 99+ and are labelled for screen readers', () => {
    const { getByLabelText, container } = render(<Badge count={120} />);
    expect(container.textContent).toBe('99+');
    expect(getByLabelText(/120 unread messages/i)).toBeTruthy();
  });

  it('empty states render a title, description and action slot', () => {
    const { getByText, getByRole } = render(
      <EmptyState title="Nothing here" description="Try again later" action={<Button>Retry</Button>} />,
    );
    expect(getByText('Nothing here')).toBeTruthy();
    expect(getByText('Try again later')).toBeTruthy();
    expect(getByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
