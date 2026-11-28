import { formatDayLabel, isDifferentDay } from './time.js';

/**
 * Flatten messages into render entries: day dividers plus per-message flags
 * for grouping (consecutive messages from one sender within 4 minutes).
 */
export function groupMessages(messages, uid) {
  const entries = [];
  let previous = null;
  for (const message of messages) {
    const createdMs = message.createdAt?.toMillis?.() ?? message.clientCreatedAt ?? Date.now();
    const newDay = !previous || isDifferentDay(previous.createdMs, createdMs);
    if (newDay) {
      entries.push({
        kind: 'divider',
        key: `divider-${message.id}`,
        label: formatDayLabel(message.createdAt || message.clientCreatedAt || Date.now()),
      });
    }
    // Consecutive messages from one sender inside 4 minutes collapse together
    // (and never across a day divider).
    const grouped =
      Boolean(previous) &&
      !newDay &&
      previous.message.senderId === message.senderId &&
      createdMs - previous.createdMs < 4 * 60 * 1000;
    entries.push({
      kind: 'message',
      message,
      isOwn: message.senderId === uid,
      showAvatar: !grouped,
      showSender: !grouped,
      previousSender: previous?.message.senderId || null,
      createdMs,
    });
    previous = { message, createdMs };
  }
  return entries;
}

