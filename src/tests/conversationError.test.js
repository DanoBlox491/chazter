import { describe, expect, it } from 'vitest';
import { conversationErrorCopy } from '../lib/utils/conversationError.js';

/**
 * Error copy for the inbox.
 *
 * The previous wording said "Check your connection" for *every* failure. That
 * is actively misleading for `permission-denied`, which is a server-side
 * rejection that no amount of reconnecting can fix — and it sends people
 * looking for a network problem that doesn't exist.
 */

describe('conversation error copy', () => {
  it('does not blame the connection when the server denies access', () => {
    const copy = conversationErrorCopy({ code: 'permission-denied' });
    expect(copy.description.toLowerCase()).not.toMatch(/connection/);
    expect(copy.title.toLowerCase()).not.toMatch(/couldn’t load your chats/);
    // Points at the actual likely cause.
    expect(copy.description.toLowerCase()).toMatch(/permission|rules/);
  });

  it('treats permission-denied as a non-transient state', () => {
    const copy = conversationErrorCopy({ code: 'permission-denied' });
    expect(copy.description.toLowerCase()).not.toMatch(/keep trying|trying in the background/);
  });

  it('uses reconnecting language for transient network errors', () => {
    for (const code of ['unavailable', 'deadline-exceeded', 'internal']) {
      const copy = conversationErrorCopy({ code });
      expect(copy.title.toLowerCase()).toMatch(/reconnect/);
      expect(copy.description.toLowerCase()).toMatch(/resume|back/);
    }
  });

  it('falls back to neutral copy for unknown errors', () => {
    const copy = conversationErrorCopy({ code: 'weird-unknown' });
    expect(copy.title).toBe('We couldn’t load your chats');
    expect(copy.description.toLowerCase()).not.toMatch(/connection/);
  });

  it('handles a missing error object without throwing', () => {
    expect(() => conversationErrorCopy(undefined)).not.toThrow();
    expect(conversationErrorCopy(undefined).title).toBeTruthy();
    expect(conversationErrorCopy(null).title).toBeTruthy();
  });

  it('always returns both a title and a description', () => {
    for (const error of [undefined, null, {}, { code: 'permission-denied' }, { code: 'unavailable' }]) {
      const copy = conversationErrorCopy(error);
      expect(copy.title).toBeTruthy();
      expect(copy.description).toBeTruthy();
    }
  });
});

describe('error copy names the right subject', () => {
  it('says "servers" when the servers listener fails, not "chats"', () => {
    // The real bug this guards: clicking Servers showed "Your chats aren't
    // available yet", which points the reader at the wrong thing entirely.
    const copy = conversationErrorCopy({ code: 'permission-denied' }, { subject: 'servers' });
    expect(copy.title).toMatch(/servers/i);
    expect(copy.title).not.toMatch(/chats/i);
  });

  it('still says "chats" by default', () => {
    const copy = conversationErrorCopy({ code: 'permission-denied' });
    expect(copy.title).toMatch(/chats/i);
  });

  it('flags permission failures so the UI can name the actual fix', () => {
    expect(conversationErrorCopy({ code: 'permission-denied' }).action).toBe('deploy-rules');
    expect(conversationErrorCopy({ code: 'unavailable' }).action).toBe('retry');
    expect(conversationErrorCopy({ code: 'whatever' }).action).toBe('retry');
  });

  it('handles a deleted server distinctly from a permission problem', () => {
    const copy = conversationErrorCopy({ code: 'not-found' }, { subject: 'servers' });
    expect(copy.action).toBe('back');
    expect(copy.title).not.toMatch(/permission/i);
  });
});
