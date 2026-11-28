import { useCallback, useEffect, useRef, useState } from 'react';
import { clearTyping, setTyping, subscribeTyping } from '../lib/services/conversationService.js';

/**
 * Typing indicator controller for one conversation.
 *
 * - `onInput()` is called from the composer; it throttles the Firestore write
 *   (handled in the service) so typing doesn't flood the network.
 * - Locally we assume we're typing for 4s after the last keystroke, which
 *   matches the TTL on the remote doc closely enough that the bubble appears
 *   and disappears smoothly.
 * - Incoming names come from a tiny listener on the typing subcollection.
 */
export function useTyping(conversationId, uid, profile) {
  const [typingNames, setTypingNames] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const stopTimer = useRef(null);

  useEffect(() => {
    if (!conversationId || !uid) return undefined;
    const unsubscribe = subscribeTyping(
      conversationId,
      uid,
      (names) => setTypingNames(names),
      () => {},
    );
    return () => {
      unsubscribe();
      clearTyping(conversationId, uid);
    };
  }, [conversationId, uid]);

  useEffect(() => () => clearTimeout(stopTimer.current), []);

  const signalTyping = useCallback(() => {
    if (!conversationId || !uid) return;
    if (!isTyping) setIsTyping(true);
    setTyping(conversationId, uid, profile);
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      setIsTyping(false);
      clearTyping(conversationId, uid);
    }, 3500);
  }, [conversationId, uid, profile, isTyping]);

  const stopTyping = useCallback(() => {
    clearTimeout(stopTimer.current);
    setIsTyping(false);
    if (conversationId && uid) clearTyping(conversationId, uid);
  }, [conversationId, uid]);

  return { typingNames, isTyping, signalTyping, stopTyping };
}
