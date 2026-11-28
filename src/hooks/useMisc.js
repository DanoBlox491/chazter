import { useCallback, useEffect, useRef, useState } from 'react';

/** Set document.title for a page, restoring nothing (SPA convention). */
export function useDocumentTitle(title, deps = []) {
  useEffect(() => {
    if (title) document.title = title.includes('Chazter') ? title : `${title} · Chazter`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Media query hook (SSR-safe). */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, [query]);

  return matches;
}

/** Debounced mirror of a value — used for search inputs. */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Run a handler on Escape and/or outside clicks of a ref'd element. */
export function useDismiss(ref, handler, { escape = true, outside = true, enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event) => {
      if (escape && event.key === 'Escape') handler(event);
    };
    const onPointer = (event) => {
      if (outside && ref.current && !ref.current.contains(event.target)) handler(event);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [ref, handler, escape, outside, enabled]);
}

/**
 * Track element scroll for "jump to latest" affordances and auto-scroll
 * pinning in the message list.
 */
export function useScrollAnchor(ref, deps = []) {
  const [isPinnedToBottom, setPinned] = useState(true);
  const [showJumpButton, setShowJumpButton] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const onScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      setPinned(distance < 90);
      setShowJumpButton(distance > 320);
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => node.removeEventListener('scroll', onScroll);
  }, [ref]);

  const scrollToBottom = useCallback(
    (behavior = 'smooth') => {
      const node = ref.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior });
    },
    [ref],
  );

  // Auto-follow new messages only when the reader is already at the bottom.
  useEffect(() => {
    if (!isPinnedToBottom) return;
    const node = ref.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { isPinnedToBottom, showJumpButton, scrollToBottom };
}

/** Copy text with a short-lived "copied" flag for inline confirmation. */
export function useCopy({ resetAfter = 1600 } = {}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(
    async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), resetAfter);
        return true;
      } catch {
        return false;
      }
    },
    [resetAfter],
  );
  return { copied, copy };
}
