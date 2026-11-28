/**
 * Presence derivation — pure, no Firebase imports.
 *
 * A user is "online" when their last heartbeat is recent. Deriving rather
 * than trusting a boolean means a crashed tab or dead battery can never leave
 * a permanent green dot.
 */
import { PRESENCE_STALE_MS } from './models.js';
import { toMillis } from '../utils/time.js';

export function isUserOnline(profile, now = Date.now()) {
  const presence = profile?.presence;
  if (!presence || presence.state === 'offline') return false;
  const ms = toMillis(presence.lastActiveAt);
  if (!ms) return false;
  return now - ms < PRESENCE_STALE_MS;
}
