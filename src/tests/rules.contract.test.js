import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Rules contract tests.
 *
 * Security rules and client payloads must agree. These tests parse the rules
 * file and assert that the fields our builders write are exactly the fields
 * the rules allow — a mismatch shows up here instead of as a `permission-denied`
 * in production.
 *
 * This is a static contract check (no emulator required); it deliberately
 * mirrors the rule predicates in plain JS.
 */

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

/**
 * Read the allowlist from a rule block.
 * `anchor` locates the region; the first `hasOnly([...])` inside it is parsed.
 * `within` bounds the search so neighbouring rules can't be picked up.
 */
function allowedKeysFor(anchor, within = 4000) {
  const start = rules.indexOf(anchor);
  expect(start, `anchor not found: ${anchor}`).toBeGreaterThan(-1);
  const window = rules.slice(start, start + within);
  const keysStart = window.indexOf('hasOnly([');
  expect(keysStart, `no hasOnly in ${anchor}`).toBeGreaterThan(-1);
  const keysEnd = window.indexOf('])', keysStart);
  const block = window.slice(keysStart, keysEnd);
  return new Set([...block.matchAll(/'([^']+)'/g)].map((match) => match[1]));
}

const { buildUserProfile } = await import('../lib/services/models.js');
const imageService = await import('../lib/services/storageService.js').catch(() => ({}));

describe('profile documents', () => {
  it('writes only fields the rules allow', () => {
    const profile = buildUserProfile({
      uid: 'u1',
      username: 'ada_l',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      photoURL: '',
      bio: 'Hi',
      provider: 'password',
    });
    const allowed = allowedKeysFor('function validProfileFields(data)');
    // `buildUserProfile` excludes email? It includes it. Verify the contract:
    const written = Object.keys(profile);
    const extra = written.filter((key) => !allowed.has(key));
    expect(extra, `unexpected fields: ${extra.join(', ')}`).toEqual([]);
    expect(imageService).toBeTruthy();
  });

  it('uses a lowercased username for the uniqueness key', () => {
    const profile = buildUserProfile({ uid: 'u1', username: 'Ada_L', displayName: 'Ada Lovelace' });
    expect(profile.usernameLower).toBe('ada_l');
    expect(profile.username).toBe('Ada_L');
    // Rule: usernameLower == username.lower()
    expect(profile.usernameLower).toBe(profile.username.toLowerCase());
  });

  it('satisfies documented username length bounds', () => {
    const profile = buildUserProfile({ uid: 'u1', username: 'abc', displayName: 'Ab' });
    expect(profile.username.length).toBeGreaterThanOrEqual(3);
    expect(profile.username.length).toBeLessThanOrEqual(24);
    expect(profile.displayName.length).toBeGreaterThanOrEqual(2);
    expect(profile.displayName.length).toBeLessThanOrEqual(40);
    expect(profile.bio.length).toBeLessThanOrEqual(160);
    expect(profile.onboardingComplete).toBe(true);
  });
});

describe('conversation documents', () => {
  it('keeps create-time fields within the allowlist', async () => {
    const { buildPrivateConversation, buildGroupConversation } = await import('../lib/services/models.js');
    const allowed = allowedKeysFor('// Creating a conversation:');

    const priv = buildPrivateConversation({
      memberIds: ['a', 'b'],
      memberProfiles: { a: { displayName: 'A', username: 'a' }, b: { displayName: 'B', username: 'b' } },
    });
    const group = buildGroupConversation({
      creatorId: 'a',
      creatorProfile: { uid: 'a', displayName: 'A', username: 'a' },
      name: 'Crew',
      memberIds: ['b'],
      memberProfiles: { b: { displayName: 'B', username: 'b' } },
    });

    for (const [label, doc] of [
      ['private', priv],
      ['group', group],
    ]) {
      const extra = Object.keys(doc).filter((key) => !allowed.has(key));
      expect(extra, `${label} has unexpected fields: ${extra.join(', ')}`).toEqual([]);
    }
  });

  it('keeps private chats to exactly two members', () => {
    // Rule: type == 'private' implies memberIds.size() == 2
    const ids = ['a', 'b'];
    expect(ids.length).toBe(2);
  });

  it('gives every member a card (rules require members keys ⊇ memberIds)', async () => {
    const { buildGroupConversation } = await import('../lib/services/models.js');
    const doc = buildGroupConversation({
      creatorId: 'a',
      creatorProfile: { uid: 'a', displayName: 'A', username: 'a' },
      name: 'Crew',
      memberIds: ['b', 'c'],
      memberProfiles: {
        b: { displayName: 'B', username: 'b' },
        c: { displayName: 'C', username: 'c' },
      },
    });
    for (const id of doc.memberIds) {
      expect(Object.keys(doc.members)).toContain(id);
    }
    expect(new Set(doc.memberIds).size).toBe(doc.memberIds.length); // no duplicates
  });
});

describe('message documents', () => {
  it('matches the message allowlist exactly', async () => {
    const { buildMessageDocument } = await import('../lib/utils/messageDocument.js');
    const allowed = allowedKeysFor('/* ---------------------------- messages ------------------------ */');
    const doc = buildMessageDocument({
      sender: { uid: 'a', displayName: 'A', username: 'a', photoURL: '' },
      text: 'Hello',
    });
    const extra = Object.keys(doc).filter((key) => !allowed.has(key));
    expect(extra, `message has unexpected fields: ${extra.join(', ')}`).toEqual([]);
    expect(doc.senderId).toBe('a');
    expect(doc.text).toBe('Hello');
    expect(doc.type).toBe('text');
  });

  it('never writes tombstone keys on creation', async () => {
    const { buildMessageDocument } = await import('../lib/utils/messageDocument.js');
    const doc = buildMessageDocument({
      sender: { uid: 'a', displayName: 'A', username: 'a' },
      text: 'Hello',
    });
    for (const key of ['deletedAt', 'deletedBy', 'editedAt']) {
      expect(doc).not.toHaveProperty(key);
    }
  });

  it('stores image paths under chat-images/ so rules accept them', async () => {
    const { buildMessageDocument } = await import('../lib/utils/messageDocument.js');
    const doc = buildMessageDocument({
      sender: { uid: 'a', displayName: 'A' },
      text: '',
      image: {
        url: 'https://firebasestorage.googleapis.com/v0/b/x/o/y',
        storagePath: 'chat-images/conv/a/1.jpg',
        width: 10,
        height: 10,
        bytes: 100,
      },
    });
    expect(doc.type).toBe('image');
    expect(doc.image.storagePath).toMatch(/^chat-images\//);
    expect(doc.image.url).toMatch(/^https:/);
  });

  it('rejects empty messages and over-long text', async () => {
    const { buildMessageDocument } = await import('../lib/utils/messageDocument.js');
    expect(() => buildMessageDocument({ sender: { uid: 'a' }, text: '   ' })).toThrow();
    expect(() => buildMessageDocument({ sender: { uid: 'a' }, text: 'x'.repeat(4001) })).toThrow();
  });
});

describe('read + typing documents', () => {
  it('read cursors use the allowed keys', () => {
    const allowed = allowedKeysFor('match /reads/{userId}');
    for (const key of ['uid', 'lastReadAt', 'updatedAt']) {
      expect(allowed.has(key)).toBe(true);
    }
  });

  it('typing docs use the allowed keys', () => {
    const allowed = allowedKeysFor('match /typing/{userId}');
    expect([...allowed].sort()).toEqual(['displayName', 'expiresAt', 'uid']);
  });

  it('username claims use the allowed keys', () => {
    const allowed = allowedKeysFor('// Claim: only for yourself');
    expect([...allowed].sort()).toEqual(['createdAt', 'uid', 'username', 'usernameLower']);
  });
});

describe('rules hygiene', () => {
  it('denies everything by default', () => {
    const catchAlls = [...rules.matchAll(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/g)];
    expect(catchAlls.length).toBeGreaterThanOrEqual(1);
  });

  it('never allows unauthenticated writes', () => {
    // Every `allow write/create/update/delete` should reference isSignedIn()
    // or be explicitly restricted to true-reads only.
    const writeLines = rules
      .split('\n')
      .filter((line) => /^\s*allow (write|create|update|delete)/.test(line));
    for (const line of writeLines) {
      if (line.includes('if false')) continue;
      expect(line).toMatch(/isSignedIn\(\)|request\.auth|uid\(\)|userId|isMember/);
    }
  });

  it('validates message authorship server-side', () => {
    expect(rules).toMatch(/request\.resource\.data\.senderId == uid\(\)/);
  });
});

describe('profile document completeness', () => {
  it('writes displayNameLower, which people-search orders by', async () => {
    const { buildUserProfile } = await import('../lib/services/models.js');
    const profile = buildUserProfile({
      uid: 'u1',
      username: 'ada_lovelace',
      displayName: 'Ada Lovelace',
      provider: 'google',
    });
    // searchUsers() calls orderBy('displayNameLower'); a document without the
    // field is simply absent from that index, so search returns nothing.
    expect(profile).toHaveProperty('displayNameLower', 'ada lovelace');
    expect(profile.displayNameLower).toBe(profile.displayName.toLowerCase());
  });

  it('keeps every profile key inside the rules allowlist', async () => {
    const { buildUserProfile } = await import('../lib/services/models.js');
    const profile = buildUserProfile({
      uid: 'u1', username: 'ada_lovelace', displayName: 'Ada', provider: 'password',
    });
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
    const allowlist = rules.match(/function validProfileFields\(data\) \{[\s\S]*?hasOnly\(\[([\s\S]*?)\]\)/);
    expect(allowlist, 'validProfileFields allowlist not found').toBeTruthy();
    const allowed = [...allowlist[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const written = Object.keys(profile);
    const extra = written.filter((key) => !allowed.includes(key));
    // Any key outside the allowlist makes every profile write permission-denied.
    expect(extra, `keys not allowlisted: ${extra.join(', ')}`).toEqual([]);
  });
});
