import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeMessages, fetchOlderMessages } from '../lib/services/messageService.js';
import { subscribeReadCursors, updateReadCursor } from '../lib/services/conversationService.js';
import { toMillis } from '../lib/utils/time.js';

/**
 * Live messages for one conversation.
 *
 * Also owns the read cursor: whenever the newest message is from someone else
 * and the tab is visible, we advance our cursor (throttled) so senders see
 * their ticks turn. Returning `receipts` as a uid→millis map keeps the tick
 * computation a pure, testable function of local state.
 */
export function useMessages(conversationId, uid) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [receipts, setReceipts] = useState({});
  const lastCursorWrite = useRef(0);
  const conversationRef = useRef(conversationId);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    conversationRef.current = conversationId;
    setMessages([]);
    setReceipts({});
    setLoading(Boolean(conversationId));
    setHasMore(false);
    setError(null);
    if (!conversationId) {
      setLoading(false);
      return undefined;
    }

    const unsubscribeMessages = subscribeMessages(conversationId, {
      onData: (list, info) => {
        if (!mountedRef.current || conversationRef.current !== conversationId) return;
        setMessages(list);
        setHasMore(Boolean(info?.hasMore));
        setLoading(false);
      },
      onError: (listenerError) => {
        if (!mountedRef.current) return;
        console.error('[chazter] messages listener', listenerError);
        setError(listenerError);
        setLoading(false);
      },
    });

    const unsubscribeReceipts = subscribeReadCursors(
      conversationId,
      (cursors) => {
        if (!mountedRef.current || conversationRef.current !== conversationId) return;
        setReceipts(cursors);
      },
      () => {},
    );

    return () => {
      unsubscribeMessages();
      unsubscribeReceipts();
    };
  }, [conversationId]);

  // Advance the read cursor when new incoming messages arrive.
  useEffect(() => {
    if (!conversationId || !uid || messages.length === 0) return;
    const newest = messages[messages.length - 1];
    if (!newest || newest.senderId === uid) return;
    const millis = toMillis(newest.createdAt) || Date.now();
    if (document.visibilityState !== 'visible') return;
    if (millis <= lastCursorWrite.current) return;
    lastCursorWrite.current = millis;
    updateReadCursor(conversationId, uid, millis);
  }, [conversationId, uid, messages]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    try {
      const older = await fetchOlderMessages(conversationId, messages[0]);
      if (!mountedRef.current) return;
      setMessages((current) => {
        const existing = new Set(current.map((message) => message.id));
        const merged = [...older.filter((message) => !existing.has(message.id)), ...current];
        return merged;
      });
      setHasMore(older.length > 0);
    } catch (loadError) {
      console.warn('[chazter] could not load older messages', loadError?.code);
    } finally {
      if (mountedRef.current) setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder, messages]);

  /** Optimistic insert for the sender's own message before the server confirms. */
  const appendOptimistic = useCallback((message) => {
    setMessages((current) => [...current, message]);
  }, []);

  const replaceOptimistic = useCallback((tempId, realMessage) => {
    setMessages((current) => {
      const withoutTemp = current.filter((message) => message.id !== tempId);
      if (withoutTemp.some((message) => message.id === realMessage.id)) return withoutTemp;
      return [...withoutTemp, realMessage].sort(
        (a, b) => toMillis(a.createdAt) - toMillis(b.createdAt),
      );
    });
  }, []);

  const dropOptimistic = useCallback((tempId) => {
    setMessages((current) => current.filter((message) => message.id !== tempId));
  }, []);

  const latestMillis = useMemo(
    () => (messages.length ? toMillis(messages[messages.length - 1].createdAt) : 0),
    [messages],
  );

  return {
    messages,
    loading,
    error,
    hasMore,
    loadingOlder,
    loadOlder,
    receipts,
    latestMillis,
    appendOptimistic,
    replaceOptimistic,
    dropOptimistic,
  };
}
