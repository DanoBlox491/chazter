/**
 * Read-receipt maths — pure functions shared by the UI and tests.
 */
export function receiptsForMessage(cursors, messageMillis, senderId) {
  if (!messageMillis) return [];
  return Object.entries(cursors || {})
    .filter(([uid, lastRead]) => uid !== senderId && Number(lastRead) >= messageMillis)
    .map(([uid]) => uid);
}

/** Delivery state for the sender's ticks. */
export function deliveryState({ pending, readCount, otherMemberCount }) {
  if (pending) return 'pending';
  if (readCount > 0 && readCount >= otherMemberCount) return 'read-all';
  if (readCount > 0) return 'read-some';
  return 'sent';
}
