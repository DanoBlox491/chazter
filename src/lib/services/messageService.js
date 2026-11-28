/**
 * Messages: send, watch, edit-free delete, receipts and unread accounting.
 *
 * Unread counts are stored on the parent conversation (`unreadCounts.<uid>`)
 * and incremented with FieldValue.increment inside the same batch as the
 * message write — so the inbox badge is live without any extra listeners.
 * Arrays and maps mean "at most one write per message per member", unchanged
 * from the design goals and cheap on reads.
 */
import {
  FieldValue,
  collection,
  deleteField,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { COLLECTIONS } from './models.js';
import { AppError } from '../utils/errors.js';
import {
  buildMessageDocument,
  previewFor,
  MessageValidationError,
} from '../utils/messageDocument.js';

const convRef = (conversationId) => doc(db, COLLECTIONS.conversations, conversationId);
const messagesCol = (conversationId) =>
  collection(db, COLLECTIONS.conversations, conversationId, COLLECTIONS.messages);
const messageRef = (conversationId, messageId) =>
  doc(db, COLLECTIONS.conversations, conversationId, COLLECTIONS.messages, messageId);

const MESSAGE_PAGE_SIZE = 30;

/**
 * Send a message and update the conversation's denormalised inbox fields +
 * unread counters in one atomic batch.
 */
export async function sendMessage(conversationId, sender, { text, image, replyTo, memberIds }) {
  const conversation = await getDoc(convRef(conversationId));
  if (!conversation.exists()) throw new AppError('conversation-not-found');
  const data = conversation.data();
  if (!data.memberIds?.includes(sender.uid)) throw new AppError('not-a-member');

  let payload;
  try {
    payload = buildMessageDocument({ sender, text, image, replyTo });
  } catch (error) {
    if (error instanceof MessageValidationError) {
      throw new AppError('empty-message', error.message);
    }
    throw error;
  }
  // The pure builder uses a sentinel so it stays Firestore-free.
  payload.createdAt = serverTimestamp();
  const batch = writeBatch(db);
  const newMessageRef = doc(messagesCol(conversationId));

  batch.set(newMessageRef, payload);

  const members = data.memberIds || memberIds || [];
  const patch = {
    lastMessage: {
      text: previewFor(payload),
      senderId: sender.uid,
      senderName: sender.displayName,
      type: payload.type,
      // Server timestamp — the rule validates lastMessage shape but not the
      // clock, so keep it server-authoritative for ordering consistency.
      createdAt: serverTimestamp(),
    },
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    [`lastReadAt.${sender.uid}`]: serverTimestamp(),
    [`unreadCounts.${sender.uid}`]: 0,
    [`typing.${sender.uid}`]: deleteField(),
  };
  for (const memberId of members) {
    if (memberId !== sender.uid) {
      patch[`unreadCounts.${memberId}`] = increment(1);
    }
  }
  batch.update(convRef(conversationId), patch);
  await batch.commit();
  return newMessageRef.id;
}

/**
 * Most recent page of messages (ascending for rendering).
 * Subscribe for realtime; `olderThan` supports pagination.
 */
export function subscribeMessages(conversationId, { pageSize = MESSAGE_PAGE_SIZE, onData, onError }) {
  const q = query(
    messagesCol(conversationId),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );
  let firstLoad = true;
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((item) => ({ id: item.id, ...item.data() })).reverse();
      onData(list, {
        fromCache: snap.metadata.fromCache,
        hasPendingWrites: snap.metadata.hasPendingWrites,
        hasMore: snap.size === pageSize,
        firstLoad,
      });
      firstLoad = false;
    },
    onError,
  );
}

export async function fetchOlderMessages(conversationId, oldestMessage, { pageSize = MESSAGE_PAGE_SIZE } = {}) {
  const anchor = oldestMessage?.createdAt;
  if (!anchor) return [];
  const q = query(
    messagesCol(conversationId),
    orderBy('createdAt', 'desc'),
    startAfter(anchor),
    limit(pageSize),
  );
  const { getDocs } = await import('firebase/firestore');
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ id: item.id, ...item.data() })).reverse();
}

/** Soft-delete: the message remains as a tombstone so receipts stay coherent. */
export async function deleteMessage(conversationId, messageId, uid, { isAdmin = false } = {}) {
  const ref = messageRef(conversationId, messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.senderId !== uid && !isAdmin) {
    throw new AppError('permission-denied', 'You can only delete your own messages.');
  }
  await updateDoc(ref, {
    deletedAt: serverTimestamp(),
    deletedBy: uid,
    text: '',
    image: FieldValue.delete(),
    replyTo: null,
  });
  // Keep the inbox preview honest if this was the newest message.
  const conversation = await getDoc(convRef(conversationId));
  if (conversation.exists() && conversation.data().lastMessage?.senderId === data.senderId) {
    const last = conversation.data().lastMessage;
    if (last.text === previewFor(data)) {
      await updateDoc(convRef(conversationId), {
        'lastMessage.text': 'This message was deleted',
      });
    }
  }
}

/** Hard delete, used by admins for abusive content and by clean-up jobs. */
export async function permanentlyDeleteMessage(conversationId, messageId, uid, { isAdmin = false } = {}) {
  const ref = messageRef(conversationId, messageId);
  const { deleteDoc, getDoc: readDoc } = await import('firebase/firestore');
  const snap = await readDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().senderId !== uid && !isAdmin) {
    throw new AppError('permission-denied', 'You can only delete your own messages.');
  }
  await deleteDoc(ref);
}

export { where };

