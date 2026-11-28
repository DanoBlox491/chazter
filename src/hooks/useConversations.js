import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeConversations } from '../lib/services/conversationService.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Live conversation list for the signed-in user.
 *
 * Dedupes state updates by comparing the snapshot's `fromCache` flag and the
 * last message cursor so the inbox doesn't re-render on identical data from
 * Firestore's in-memory cache.
 */
export function useConversations() {
  const { uid } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ fromCache: false });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!uid) {
      setConversations([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = subscribeConversations(
      uid,
      (list, info) => {
        if (!mounted.current) return;
        setConversations(list);
        setMeta({ fromCache: Boolean(info?.fromCache) });
        setLoading(false);
        setError(null);
      },
      (listenerError) => {
        if (!mounted.current) return;
        console.error('[chazter] conversations listener', listenerError);
        setError(listenerError);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [uid]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0),
    [conversations],
  );

  const unreadConversations = useMemo(
    () => conversations.filter((conversation) => conversation.unreadCount > 0),
    [conversations],
  );

  const mutedIds = useMemo(
    () => new Set(conversations.filter((conversation) => conversation.muted).map((c) => c.id)),
    [conversations],
  );

  const getById = useCallback(
    (id) => conversations.find((conversation) => conversation.id === id) || null,
    [conversations],
  );

  return { conversations, loading, error, meta, totalUnread, unreadConversations, mutedIds, getById };
}
