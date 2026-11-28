<div align="center">

# Chazter

**Conversations, considered.**

A real-time messaging platform built with React, Vite and Firebase.
Private chats, small groups, read receipts, typing indicators and photo
sharing — in a calm, original interface with light and dark themes.

</div>

---

## Contents

- [What it is](#what-it-is)
- [Feature overview](#feature-overview)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Firebase setup (one-time, ~10 minutes)](#firebase-setup-one-time-10-minutes)
  - [1. Create the project](#1-create-the-project)
  - [2. Enable Authentication](#2-enable-authentication)
  - [3. Create Firestore](#3-create-firestore)
  - [4. Enable Storage (image sharing)](#4-enable-storage-image-sharing)
  - [5. Deploy the security rules](#5-deploy-the-security-rules)
  - [6. Authorise your domains](#6-authorise-your-domains)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Security model](#security-model)
- [Testing](#testing)
- [Building and deploying](#building-and-deploying)
- [Local development with the emulator suite](#local-development-with-the-emulator-suite)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

---

## What it is

Chazter is a deliberately small, focused messenger. It is **not** a social
network: there is no feed, no algorithm and no public posting. Everything you
send lives in a conversation visible only to its members, and the security
rules enforce that on the server rather than trusting the client.

The design language is "warm ink and jade": deep green-black surfaces, a warm
parchment light theme, Fraunces for display type and Inter for the interface.

## Feature overview

**Authentication**

| Feature | Status |
| --- | --- |
| Continue with Google | ✅ |
| Email + password sign-up and sign-in | ✅ |
| Password reset by email | ✅ |
| Email verification (soft prompt) | ✅ |
| Username uniqueness (transactional) | ✅ |
| Account linking (Google ⇄ password) | ✅ |
| Safe handling of duplicate-email sign-in | ✅ never auto-merges accounts |

**Profiles**

| Feature | Status |
| --- | --- |
| Unique `@username` | ✅ enforced by a Firestore transaction |
| Display name, bio, photo, join date | ✅ |
| Online / offline presence | ✅ heartbeat-derived, crash-safe |
| Profile setup screen for new accounts | ✅ |
| Avatar upload | ✅ requires Storage |
| Public profile pages | ✅ `/app/u/:username` |

**Messaging**

| Feature | Status |
| --- | --- |
| One-to-one chats | ✅ |
| Group chats | ✅ create, rename, add, promote, remove, leave |
| Real-time message delivery | ✅ Firestore listeners |
| Text messages | ✅ |
| Image sharing with captions | ✅ requires Storage |
| Timestamps and day dividers | ✅ |
| Sending / sent / read ticks | ✅ via per-member read cursors |
| Typing indicators | ✅ with automatic expiry |
| Message search | ✅ in-conversation |
| Global search (⌘K / Ctrl-K) | ✅ chats, people and messages |
| Conversation list with unread counts | ✅ denormalised, no extra reads |
| Mute and archive per conversation | ✅ |
| Delete your own messages | ✅ tombstone; admins can moderate |
| Delete a chat / leave a group | ✅ |
| Responsive layout, mobile + desktop | ✅ |
| Light / dark / system themes | ✅ persisted |

## Tech stack

- **React 19** + **Vite 8** — app shell, routing and build
- **JavaScript** (no TypeScript) with JSDoc-style intent comments
- **Firebase Authentication** — Google, email/password, password reset, linking
- **Cloud Firestore** — real-time data, offline persistence, security rules
- **Firebase Storage** — avatars and chat images
- **React Router 7** — nested routes and protected layouts
- **Vitest + Testing Library** — 132 tests across logic, rules contracts,
  rendering and accessibility
- **CSS** — hand-written design tokens, no UI framework

## Quick start

```bash
git clone https://github.com/DanoBlox491/chazter.git
cd chazter
npm install
cp .env.example .env.local     # optional: point at your own Firebase project
npm run dev
```

The app opens at <http://localhost:5173>.

> **The committed Firebase web config in `src/lib/firebase/config.js` points at
> the Chazter demo project so the app runs immediately.**
> For your own deployment, override it with `.env.local` (see
> [Environment variables](#environment-variables)) — no code changes needed.

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Full Vitest suite |
| `npm run test:watch` | Watch mode |
| `npm run emulators` | Firebase Auth + Firestore emulators |

## Firebase setup (one-time, ~10 minutes)

You only need to do this once, and only if you're deploying your own instance.
Every step below is a **manual click in the Firebase Console** — there is no
way to automate them from this repository, and none of them require a
service-account key.

### 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project** → name it
   (e.g. `chazter-prod`) → disable Google Analytics unless you want it.
2. In **Project settings → General → Your apps**, add a **Web app**.
3. Copy the `firebaseConfig` object. Put the values into `.env.local`
   (see [Environment variables](#environment-variables)).

### 2. Enable Authentication

1. **Build → Authentication → Get started**.
2. **Sign-in method → Google → Enable**. Choose a support email and save.
3. **Sign-in method → Email/Password → Enable**. Leave "Email link" off.
4. **Authentication → Settings → User actions**, enable
   *Email address verification* if you want it. (Chazter sends the email but
   does not block sign-in on it, so users are never locked out.)
5. **Authentication → Templates**: customise the *Password reset* email so it
   says "Chazter" instead of your project name.

> Note: Firebase has no built-in username login. Chazter logs in with **email**
> and uses `usernames/{handle}` documents for unique, searchable handles.

### 3. Create Firestore

1. **Build → Firestore Database → Create database**.
2. Choose **Production mode** (rules are supplied in `firestore.rules`).
3. Pick a location close to your users. **This cannot be changed later.**

### 4. Enable Storage (image sharing)

1. **Build → Storage → Get started** → Production mode.
2. Rules are supplied in `storage.rules` — deploy them in the next step.

> Without Storage the app still works: image and avatar uploads show a clear
> "Storage isn't enabled" message instead of failing silently.

### 5. Deploy the security rules

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # select your project, give it an alias
firebase deploy --only firestore:rules,firestore:indexes,storage
```

The rules are the real security boundary — **the app will not work correctly
without them**, because client writes are validated against them.

### 6. Authorise your domains

1. **Authentication → Settings → Authorized domains**.
2. `localhost` is there by default.
3. Add your production domain, e.g. `yourname.github.io` (for GitHub Pages) or
   `chazter.web.app` (for Firebase Hosting).
4. Add the emulator domains if you use the suite: `127.0.0.1`, `localhost`.

## Environment variables

Everything is optional — the committed defaults point at the demo project.
Create `.env.local` to override:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Web API key (public, not a secret) |
| `VITE_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | `<project>.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender id |
| `VITE_FIREBASE_APP_ID` | Web app id |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics id (optional) |
| `VITE_USE_FIREBASE_EMULATORS` | `true` to use local emulators |
| `VITE_BASE_PATH` | Build base path, e.g. `/chazter/` for GitHub Pages |
| `VITE_GITHUB_PAGES` | Set to `true` when building for GitHub Pages |

> **Why is the API key committed?** Because Firebase web API keys are
> *identifiers*, not secrets. They are safe in client code; all access control
> happens in Security Rules and authorised domains. **Never** commit a service
> account JSON, Admin SDK key, or the contents of *Project settings → Service
> accounts*. Nothing in this repo needs one.

## Project structure

```text
chazter/
├── firestore.rules              # Firestore security rules (deploy these)
├── firestore.indexes.json       # Composite indexes
├── storage.rules                # Cloud Storage rules
├── firebase.json                # Emulator + Hosting config
├── vite.config.js               # Build config (Vitest config mirrors it)
├── eslint.config.js             # Flat ESLint config
├── .env.example                 # Environment template
├── src/
│   ├── main.jsx                 # Entry: fonts, styles, <App/>
│   ├── App.jsx                  # Provider tree + router
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── config.js        # Web config (from env, with defaults)
│   │   │   ├── firebase.js      # Single SDK bootstrap + emulator wiring
│   │   │   └── auth.js          # Auth wrapper: sign-in, linking, resets
│   │   ├── services/
│   │   │   ├── models.js        # Firestore document shapes
│   │   │   ├── authFlow.js      # Post-sign-in state resolution (pure)
│   │   │   ├── userService.js   # Profiles, username claims, presence
│   │   │   ├── presence.js      # Online state derivation (pure)
│   │   │   ├── conversationService.js
│   │   │   ├── messageService.js
│   │   │   └── storageService.js
│   │   └── utils/
│   │       ├── validation.js    # Form + username rules
│   │       ├── errors.js        # Firebase error → human message
│   │       ├── time.js          # Timestamp formatting
│   │       ├── receipts.js      # Read-receipt maths (pure)
│   │       ├── messageDocument.js
│   │       ├── messageGroups.js
│   │       ├── conversationDisplay.js
│   │       └── colour.js
│   ├── context/                 # Auth, Theme, Toast, Workspace
│   ├── hooks/                   # useConversations, useMessages, useTyping …
│   ├── components/
│   │   ├── ui/                  # Button, Field, Avatar, Modal, States …
│   │   ├── brand/               # Mark, lockup, Google icon
│   │   ├── auth/                # AuthShell, GoogleButton
│   │   ├── layout/              # AppShell, NavRail
│   │   ├── chat/                # ChatWindow, MessageBubble, Composer …
│   │   ├── people/              # PeopleDirectory
│   │   └── system/              # ErrorBoundary
│   ├── pages/                   # Route-level screens
│   ├── routes/                  # Route table + guards
│   ├── styles/                  # tokens, base, ui, auth, app, chat, landing
│   └── tests/                   # Vitest suites
├── .github/workflows/
│   ├── ci.yml                   # Lint + test + build on every push
│   ├── deploy-pages.yml         # GitHub Pages deployment
│   └── deploy-firebase.yml      # Optional: Firebase rules + hosting
```

## Data model

```text
users/{uid}
  uid, username, usernameLower, displayName, email, photoURL, bio,
  provider, createdAt, updatedAt, onboardingComplete,
  presence: { state, lastActiveAt },
  settings: { theme, notifications }

usernames/{usernameLower}          ← the uniqueness registry
  uid, username, usernameLower, createdAt

conversations/{conversationId}
  type: 'private' | 'group'
  memberIds: [uid…]                ← the authorisation list
  members: { uid: { displayName, username, photoURL, role } }
  admins:   [uid…]
  name, photoURL, color
  lastMessage: { text, senderId, senderName, type, createdAt }
  lastMessageAt, updatedAt
  unreadCounts: { uid: number }
  lastReadAt:   { uid: Timestamp }
  mutedBy: [uid…], archivedBy: [uid…]
  createdAt, createdBy, schemaVersion

  conversations/{id}/messages/{messageId}
    type: 'text' | 'image'
    text, image: { url, storagePath, width, height, bytes }
    senderId, senderName, senderUsername, senderPhotoURL
    createdAt (server), clientCreatedAt
    deletedAt?, deletedBy?
    reactions: {}

  conversations/{id}/reads/{uid}    ← read cursor for receipts
    uid, lastReadAt, updatedAt

  conversations/{id}/typing/{uid}   ← transient typing marker
    uid, displayName, expiresAt
```

**Why this shape?** The inbox renders from **one** query — the conversation
documents already carry `lastMessage` and `unreadCounts`, so opening the app
costs one listener instead of N. Sending a message costs one batched write: the
message document plus the conversation's preview and a per-member unread
increment. Read receipts live in their own tiny document per member, which
means a chat never rewrites a growing array of readers.

## Security model

The client is never trusted. Everything below is enforced in
`firestore.rules`:

| Concern | Enforcement |
| --- | --- |
| Reading a conversation | `uid() in resource.data.memberIds` |
| Reading messages | membership check on the parent conversation |
| Sending a message | must be a member **and** `senderId == uid()` |
| Faking a timestamp | `createdAt == request.time` |
| Editing a message | updates only allowed for `{deletedAt, deletedBy, text, image, replyTo}` |
| Deleting a message | sender only (admins may soft-delete for moderation) |
| Editing a profile | `uid == userId`; immutable identity fields |
| Stealing a username | `usernames/{handle}` create fails if it exists; claims are owned |
| Unread counters | any member may reset their own; nothing else is free-form |
| Anything unmatched | `allow read, write: if false` |

Additional practices:

- **No admin credentials in the client.** The repository contains only the
  public web config.
- **Account linking is explicit.** If an email already exists with a different
  provider, Chazter refuses to merge silently and tells the user to sign in
  with the original method and link from Settings.
- **No account enumeration** on password reset: the same success screen appears
  whether or not the address exists.
- **Untrusted URLs** are parsed and protocol-checked before rendering.
- **Storage honesty:** Storage rules cannot read Firestore, so conversation
  membership cannot be verified there. Uploads are constrained to the caller's
  own path, image types and 5 MB; download URLs carry unguessable tokens. If
  you need rule-level membership checks, move uploads behind a Cloud Function.
  See `storage.rules` for the full note.

## Testing

```bash
npm test
```

| Suite | What it covers |
| --- | --- |
| `validation` | usernames, emails, passwords, bios, username suggestions |
| `time` | Firestore timestamp normalisation, day labels, last-seen |
| `authFlow` | post-sign-in state machine, linking guidance, onboarding defaults |
| `conversation` | partner resolution, previews, message grouping, receipts |
| `rules.contract` | **client document shapes vs. security rules allowlists** |
| `contrast` | WCAG AA contrast for every token in both themes |
| `render.smoke` | the real app mounted with mocked Firebase: routes, guards, inbox, chat, settings |
| `visual.snapshot` | structural rendering of bubbles, avatars, composer, rows |

The rules-contract suite is the most valuable one: it parses
`firestore.rules`, extracts the `hasOnly([…])` allowlists, and asserts the
client writes **exactly** those fields. That is the class of bug that otherwise
only appears as `permission-denied` in production.

## Building and deploying

### Build

```bash
npm run build          # -> dist/
npm run preview        # serve dist/ locally
```

### Firebase Hosting (recommended)

```bash
npm run build
firebase deploy --only hosting
```

`firebase.json` includes SPA rewrites, immutable caching for hashed assets,
`no-store` for HTML, and hardening headers (`nosniff`, `SAMEORIGIN`,
`Referrer-Policy`, restrictive `Permissions-Policy`).

### GitHub Pages

The included workflow `.github/workflows/deploy-pages.yml` builds and publishes
on every push to `main`.

1. Push the repository.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` — the workflow publishes `dist/`.
4. Add `<username>.github.io` to Firebase **Authentication → Authorized domains**.
5. **Settings → Secrets and variables → Actions → Variables**: add the
   `VITE_FIREBASE_*` variables if you deploy your own project.

Because Pages serves from `/<repo>/`, the workflow sets
`VITE_BASE_PATH=/<repo>/`. The app's router uses Vite's `BASE_URL`, so routing
keeps working under the sub-path. A `404.html` copy of `index.html` is generated
so deep links resolve.

> If the app loads but sign-in fails with `auth/unauthorized-domain`, you skipped
> step 4. If the page is blank, `VITE_BASE_PATH` didn't match the repository name.

## Local development with the emulator suite

Run the whole app without touching production data:

```bash
# terminal 1
npm run emulators        # Auth :9099, Firestore :8080, UI :4000 (needs Java)

# terminal 2
VITE_USE_FIREBASE_EMULATORS=true npm run dev
```

The emulator UI at <http://localhost:4000> lets you inspect documents live.
The Firestore emulator enforces `firestore.rules`, so this is the fastest way
to test a rules change.

> The emulator suite requires a Java runtime. If `npm run emulators` fails with
> "Could not spawn `java -version`", install a JRE 11+.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `auth/unauthorized-domain` | Domain not allowlisted | Authentication → Settings → Authorized domains |
| `permission-denied` on every read | Rules not deployed | `firebase deploy --only firestore:rules` |
| `permission-denied` when sending | Rules deployed but out of date | Re-deploy after pulling; check `rules.contract` tests |
| Image upload fails with "Storage isn't enabled" | Storage not set up | Build → Storage → Get started, then deploy `storage.rules` |
| Blank page on GitHub Pages | Wrong base path | Ensure `VITE_BASE_PATH=/<repo>/` at build time |
| Username feels "taken" but isn't | Stale claim from a failed signup | The claim is released on account deletion; delete the `usernames/{handle}` doc in the console if you are certain |
| Typing indicator stuck | Client crashed before clearing | It self-expires after 6 s |
| `auth/requires-recent-login` | Sensitive action after a long session | Sign out and back in, then retry |

## Known limitations

Documented honestly rather than hidden:

1. **Search is bounded.** Message search scans the most recent ~300 messages of
   a conversation (and the 6 most recent conversations for global search).
   Full-history search would need Algolia/Typesense or a Cloud Function.
2. **Storage rules cannot verify chat membership** (Firestore isn't readable
   from Storage rules). See the note in `storage.rules`.
3. **No push notifications.** In-app unread badges only; web push would need a
   service worker and FCM setup.
4. **Presence is a heartbeat, not a socket.** Online state can lag up to ~45 s
   and is derived from `lastActiveAt`, so a crashed tab goes offline rather than
   staying green forever.
5. **No message editing.** Deletion is supported (tombstone), editing is not.
6. **Reactions are modelled but not surfaced** in the UI yet
   (`reactions: {}` exists on messages).
7. **Username changes do not rewrite historical message `senderUsername`.**
   Display names are synced into conversation member cards; message-level
   snapshots stay as sent.
8. **Account deletion leaves your sent messages** in other people's
   conversations, marked as removed on the sender card. This is a deliberate
   product decision (the other person's history stays intact).

## Credits

- Typefaces: [Fraunces](https://fonts.google.com/specimen/Fraunces) and
  [Inter](https://fonts.google.com/specimen/Inter) via Fontsource, both OFL.
- Icons: [Lucide](https://lucide.dev), ISC licence.
- Built with React, Vite and Firebase.

## Licence

MIT
