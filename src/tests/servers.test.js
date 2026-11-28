import { describe, expect, it } from 'vitest';
import {
  normaliseChannelName,
  validateChannelName,
  validateServerName,
  canManage,
  inviteUrl,
} from '../lib/services/serverService.js';
import {
  INVITE_TYPES,
  SERVER_ROLES,
  buildChannel,
  buildInvite,
  buildServer,
  inviteCode,
} from '../lib/services/models.js';

describe('server name validation', () => {
  it('rejects empty and whitespace-only names', () => {
    expect(validateServerName('')).toBeTruthy();
    expect(validateServerName('   ')).toBeTruthy();
    expect(validateServerName(null)).toBeTruthy();
  });

  it('rejects names past the limit the rules enforce', () => {
    expect(validateServerName('a'.repeat(49))).toBeTruthy();
    expect(validateServerName('a'.repeat(48))).toBe('');
  });

  it('accepts an ordinary name', () => {
    expect(validateServerName('Design Guild')).toBe('');
  });
});

describe('channel name normalisation', () => {
  it('lowercases, strips the hash and hyphenates spaces', () => {
    expect(normaliseChannelName('#Product Updates')).toBe('product-updates');
    expect(normaliseChannelName('  Design  ')).toBe('design');
  });

  it('drops characters that would break a URL', () => {
    expect(normaliseChannelName('a/b?c#d')).toBe('abcd');
    expect(normaliseChannelName('héllo')).toBe('hllo');
  });

  it('keeps existing dashes and underscores', () => {
    expect(normaliseChannelName('dev_ops-team')).toBe('dev_ops-team');
  });

  it('rejects names that normalise to nothing', () => {
    expect(validateChannelName('///')).toBeTruthy();
    expect(validateChannelName('a')).toBeTruthy(); // too short after normalising
    expect(validateChannelName('ok')).toBe('');
  });

  it('is idempotent — normalising twice is the same as once', () => {
    const once = normaliseChannelName('Product Updates');
    expect(normaliseChannelName(once)).toBe(once);
  });
});

describe('permissions', () => {
  it('only owners and admins may manage', () => {
    expect(canManage(SERVER_ROLES.owner)).toBe(true);
    expect(canManage(SERVER_ROLES.admin)).toBe(true);
    expect(canManage(SERVER_ROLES.member)).toBe(false);
    expect(canManage(undefined)).toBe(false);
    expect(canManage(null)).toBe(false);
  });
});

describe('invite codes', () => {
  it('are long enough and use the unambiguous alphabet', () => {
    const code = inviteCode();
    expect(code).toHaveLength(10);
    // No vowels (no accidental words) and no 0/O/1/I/L (no transcription bugs).
    expect(code).toMatch(/^[2-9bcdfghjkmnpqrstvwxyz]+$/);
    expect(code).not.toMatch(/[aeiou01lo]/i);
  });

  it('do not collide across many draws', () => {
    const codes = new Set(Array.from({ length: 500 }, () => inviteCode()));
    expect(codes.size).toBe(500);
  });

  it('honour a custom length', () => {
    expect(inviteCode(16)).toHaveLength(16);
  });
});

describe('invite documents', () => {
  it('never expire', () => {
    const invite = buildInvite({
      type: INVITE_TYPES.server,
      targetId: 's1',
      targetName: 'Design Guild',
      createdBy: 'u1',
      createdByName: 'Ada',
    });
    // The whole point of the feature: null expiry, revocable instead.
    expect(invite.expiresAt).toBeNull();
    expect(invite.revoked).toBe(false);
    expect(invite.uses).toBe(0);
  });

  it('bound the target name so a huge name cannot be stored', () => {
    const invite = buildInvite({
      type: INVITE_TYPES.server,
      targetId: 's1',
      targetName: 'x'.repeat(500),
      createdBy: 'u1',
      createdByName: 'y'.repeat(500),
    });
    expect(invite.targetName.length).toBeLessThanOrEqual(48);
    expect(invite.createdByName.length).toBeLessThanOrEqual(60);
  });
});

describe('invite links', () => {
  it('is a real path, not a hash route (the app uses BrowserRouter)', () => {
    const url = inviteUrl('abcd2345', 'https://danoblox491.github.io');
    expect(url).toContain('/join/abcd2345');
    expect(url).not.toContain('#');
  });

  it('includes the deploy base path', () => {
    const url = inviteUrl('abcd2345', 'https://danoblox491.github.io');
    // import.meta.env.BASE_URL is '/' under vitest.
    expect(url).toBe('https://danoblox491.github.io/join/abcd2345');
  });

  it('does not double up slashes when the origin has a trailing one', () => {
    expect(inviteUrl('abcd2345', 'https://example.com/')).toBe('https://example.com/join/abcd2345');
  });
});

describe('server and channel documents', () => {
  const owner = { uid: 'u1', displayName: 'Ada', username: 'ada', photoURL: '' };

  it('builds an owner-first server with the channel list denormalised', () => {
    const server = buildServer({
      ownerId: 'u1',
      ownerProfile: owner,
      name: 'Design Guild',
      channels: [{ id: 'c1' }],
    });
    expect(server.ownerId).toBe('u1');
    expect(server.channelIds).toEqual(['c1']);
    expect(server.memberCount).toBe(1);
    expect(server.name).toBe('Design Guild');
  });

  it('trims server names in the payload itself, not only in validation', () => {
    const server = buildServer({
      ownerId: 'u1',
      ownerProfile: owner,
      name: '  Design Guild  ',
      channels: [{ id: 'c1' }],
    });
    expect(server.name).toBe('Design Guild');
  });

  it('builds a channel as a conversation so messaging can be reused', () => {
    const channel = buildChannel({
      serverId: 's1',
      name: 'general',
      createdBy: 'u1',
      creatorProfile: owner,
      memberIds: ['u1', 'u2'],
      memberProfiles: { u2: { uid: 'u2', displayName: 'Bo', username: 'bo' } },
    });
    expect(channel.type).toBe('channel');
    expect(channel.serverId).toBe('s1');
    // Every member has a card, which the conversation rules require.
    expect(Object.keys(channel.members).sort()).toEqual(['u1', 'u2']);
    expect(channel.unreadCounts).toEqual({ u1: 0, u2: 0 });
  });

  it('deduplicates channel members', () => {
    const channel = buildChannel({
      serverId: 's1',
      name: 'general',
      createdBy: 'u1',
      creatorProfile: owner,
      memberIds: ['u1', 'u1', 'u2', 'u2'],
      memberProfiles: {},
    });
    expect(channel.memberIds.sort()).toEqual(['u1', 'u2']);
  });
});
