import { useEffect, useRef, useState } from 'react';
import { subscribeServers, subscribeChannels } from '../lib/services/serverService.js';
import { useAuth } from '../context/AuthContext.jsx';

/** Live list of servers the signed-in user belongs to. */
export function useServers() {
  const { uid } = useAuth();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!uid) {
      setServers([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = subscribeServers(
      uid,
      (list) => {
        if (!mounted.current) return;
        setServers(list);
        setLoading(false);
        setError(null);
      },
      (listenerError) => {
        if (!mounted.current) return;
        console.error('[chazter] servers listener', listenerError);
        setError(listenerError);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [uid]);

  return { servers, loading, error };
}

/** Live channels for one server. */
export function useChannels(serverId) {
  const { uid } = useAuth();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(Boolean(serverId));
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setChannels([]);
    setError(null);
    if (!serverId) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = subscribeChannels(
      serverId,
      uid,
      (list) => {
        if (!mounted.current) return;
        setChannels(list);
        setLoading(false);
      },
      (listenerError) => {
        if (!mounted.current) return;
        console.error('[chazter] channels listener', listenerError);
        setError(listenerError);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [serverId, uid]);

  return { channels, loading, error };
}
