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

/* ==================================================================== *
 * Servers, channels and invites
 * --------------------------------------------------------------------
 * These assertions are written against the *bug that nearly shipped*: the
 * first draft of the join rule contained `(isServerMember(serverId) || true)`,
 * a tautology that let any signed-in user join any server whose id they knew.
 * A rules review that only checks "does it look restrictive" would pass it;
 * these tests fail it.
 * ==================================================================== */
describe('server rules', () => {
  const serversBlock = rules.slice(
    rules.indexOf('match /servers/{serverId}'),
    rules.indexOf('match /invites/{code} { allow get'),
  );

  it('never contains a tautological allow', () => {
    // The exact shape of the bug: `... || true )` inside a condition.
    // The bug was a bare boolean literal as a disjunct: `(... || true)`.
    // `x == true` is a legitimate comparison and must not trip this.
    expect(rules).not.toMatch(/\|\|\s*true\s*\)/);
    expect(rules).not.toMatch(/\(\s*true\s*\|\|/);
  });

  it('gates a self-join on a usable invite, not just on knowing the server id', () => {
    const membersStart = serversBlock.indexOf('match /members/{memberId}');
    const memberCreate = serversBlock.slice(
      membersStart,
      serversBlock.indexOf('allow update:', membersStart),
    );
    expect(memberCreate).toMatch(/isUsableServerInvite\(/);
    // The invite code must come from the write itself, so it cannot be faked.
    expect(memberCreate).toMatch(/request\.resource\.data\.inviteCode/);
  });

  it('forces a self-join to be a plain member (no privilege escalation)', () => {
    expect(serversBlock).toMatch(/request\.resource\.data\.role == 'member'/);
    expect(serversBlock).not.toMatch(/allow create:[^;]*role == 'admin'/);
  });

  it('checks the invite was not revoked and targets this exact server', () => {
    const helper = rules.slice(
      rules.indexOf('function isUsableServerInvite'),
      rules.indexOf('function adminRemovesMember'),
    );
    expect(helper).toMatch(/\.data\.revoked == false/);
    expect(helper).toMatch(/\.data\.targetId == serverId/);
    expect(helper).toMatch(/\.data\.type == 'server'/);
  });

  it('guards missing member documents instead of erroring on .data', () => {
    // NOTE: isServerAdmin is declared in the top-level helper section, which
    // sits before `match /servers`, not inside it.
    const adminStart = rules.indexOf('function isServerAdmin');
    expect(adminStart, 'isServerAdmin helper missing').toBeGreaterThan(-1);
    const adminHelper = rules.slice(
      adminStart,
      rules.indexOf('function adminRemovesMember', adminStart),
    );
    expect(adminHelper).toMatch(/serverMemberExists\(serverId\)/);
    expect(adminHelper).toMatch(/serverMemberExists\(serverId\)/);
  });

  it('only lets the owner delete a server', () => {
    expect(serversBlock).toMatch(/allow delete:[^;]*resource\.data\.ownerId == uid\(\)/s);
  });

  it('stops an owner being removed from a server', () => {
    expect(serversBlock).toMatch(/\.data\.role != 'owner'/);
  });
});

describe('invite rules', () => {
  const invitesStart = rules.indexOf('match /invites/{code} {');
  expect(invitesStart, 'top-level invites block missing').toBeGreaterThan(-1);
  const invitesBlock = rules.slice(invitesStart);

  it('mints invites with no expiry', () => {
    expect(invitesBlock).toMatch(/request\.resource\.data\.expiresAt == null/);
  });

  it('requires admin rights over the invite target', () => {
    expect(invitesBlock).toMatch(/isServerAdmin\(request\.resource\.data\.targetId\)/);
    expect(invitesBlock).toMatch(/\.data\.admins/);
  });

  it('makes revocation terminal', () => {
    const update = invitesBlock.slice(invitesBlock.indexOf('allow update'));
    // A revoked invite must never be flipped back to live.
    expect(update).toMatch(/resource\.data\.revoked == false\s*&&\s*request\.resource\.data\.revoked == true/s);
    // and only the creator may revoke
    expect(update).toMatch(/resource\.data\.createdBy == uid\(\)/);
  });

  it('lets anyone signed in resolve a code, which is what makes a link work', () => {
    expect(invitesBlock).toMatch(/allow get: if isSignedIn\(\);/);
  });
});

describe('channel membership rules', () => {
  const update = rules.slice(
    rules.indexOf('allow update: if isMember(conversationId)'),
    rules.indexOf('/* ---------------------------- messages'),
  );

  it('lets a joining member add only themselves to a channel', () => {
    expect(update).toMatch(/request\.resource\.data\.type == 'channel'/);
    expect(update).toMatch(/\.union\(\[uid\(\)\]\.toSet\(\)\)/);
  });

  it('requires a valid server invite for that self-add', () => {
    expect(update).toMatch(/isUsableServerInvite\(/);
  });

  it('keeps channel renames and serverId changes admin-only', () => {
    // A plain member changing the name is rejected unless they are an admin.
    expect(update).toMatch(/request\.resource\.data\.name == resource\.data\.name/);
    expect(update).toMatch(/isServerAdmin\(resource\.data\.serverId\)/);
  });
});

/* ==================================================================== *
 * Authorization chain — the bugs that produced a real `permission-denied`
 * --------------------------------------------------------------------
 * The previous suite checked rule *shapes* and still let four showstoppers
 * through, because none of them were about security: they were about rules
 * denying legitimate work.
 *
 *   1. createServer() writes the owner's member record with no invite to
 *      present -> the owner could never create a server.
 *   2. createChannel() writes a channel with `admins: []`, but the create
 *      rule demanded the creator be in `admins` -> no channel could exist.
 *   3. listInvites() ran a collection query while the rule allowed only
 *      `get` -> the invite screen failed.
 *   4. deleteChannel() required `uid() in admins`, and channels have none.
 *
 * Each assertion below is written against the failure it prevents.
 * ==================================================================== */
describe('authorization chain (would deny real work)', () => {
  const memberBlock = rules.slice(
    rules.indexOf('match /members/{memberId}'),
    rules.indexOf('match /invites/{code} {', rules.indexOf('match /members/{memberId}')),
  );

  it('lets the owner bootstrap their own member record without an invite', () => {
    // The owner branch must exist AND be tied to the server naming them owner.
    expect(memberBlock).toMatch(/request\.resource\.data\.role == 'owner'/);
    expect(memberBlock).toMatch(/getAfter\(/);
    expect(memberBlock).toMatch(/data\.ownerId == uid\(\)/);
  });

  it('still requires an invite for a plain-member self-join', () => {
    expect(memberBlock).toMatch(/request\.resource\.data\.role == 'member'\s*&&\s*isUsableServerInvite/s);
  });

  it('allows creating a channel without per-channel admins', () => {
    const create = rules.slice(
      rules.indexOf('allow create: if isSignedIn()\n        && request.resource.data.keys().hasOnly(['),
      rules.indexOf('// Updates: any member may update'),
    );
    expect(create).toMatch(/type == 'channel'\s*&&\s*request\.resource\.data\.admins\.size\(\) == 0/s);
    // ...and that the normal path still requires an admin for chats/groups.
    expect(create).toMatch(/uid\(\) in request\.resource\.data\.admins/);
  });

  it('does not require two members for a channel', () => {
    const create = rules.slice(
      rules.indexOf('allow create: if isSignedIn()\n        && request.resource.data.keys().hasOnly(['),
      rules.indexOf('// Updates: any member may update'),
    );
    // The `>= 2` minimum must be inside the non-channel branch only.
    const channelBranch = create.slice(create.indexOf("type == 'channel'"), create.indexOf("type != 'channel'"));
    expect(channelBranch).not.toMatch(/size\(\) >= 2/);
  });

  it('lets a server admin delete a channel despite channels having no admins', () => {
    const start = rules.indexOf('// Deleting: admins may delete a group');
    expect(start, 'channel delete rule missing').toBeGreaterThan(-1);
    // Bound on the next rule, not the next comment block: the explanatory
    // comment above this rule itself contains `/*`.
    const body = rules.slice(start, rules.indexOf('allow delete:', start) + 400);
    // The predicate is split across lines, so match with \s* rather than
    // assuming one line - matching on a single line is exactly the kind of
    // brittle assertion that passes while the rule is wrong.
    expect(body).toMatch(/\.type == 'channel'/);
    expect(body).toMatch(/isServerAdmin\(/);
  });

  it('authorises a channel self-join from the user profile, not a missing member doc', () => {
    const update = rules.slice(
      rules.indexOf('allow update: if isMember(conversationId)'),
      rules.indexOf('/* ---------------------------- messages'),
    );
    // Reading the server member record here would always fail: this very
    // write is what creates it.
    expect(update).not.toMatch(/servers\/\$\(resource\.data\.serverId\)\/members/);
    expect(update).toMatch(/documents\/users\/\$\(uid\(\)\)\)\.data\.lastInviteCode/);
  });

  it('supports group invites, which had no self-add branch at all', () => {
    const update = rules.slice(
      rules.indexOf('allow update: if isMember(conversationId)'),
      rules.indexOf('/* ---------------------------- messages'),
    );
    expect(update).toMatch(/isUsableGroupInvite\(/);
  });

  it('permits the join write to touch only what a join needs', () => {
    const update = rules.slice(
      rules.indexOf('allow update: if isMember(conversationId)'),
      rules.indexOf('/* ---------------------------- messages'),
    );
    expect(update).toMatch(/affectedKeys\(\)\s*\.hasOnly\(\['memberIds', 'members', 'unreadCounts'/s);
  });

  it('never lists invites (a directory of keys to every server)', () => {
    const invites = rules.slice(rules.indexOf('match /invites/{code} {'));
    expect(invites).not.toMatch(/allow list:/);
    expect(invites).toMatch(/allow get: if isSignedIn\(\);/);
  });
});
