import { useCallback, useEffect, useRef, useState } from 'react';
import { evaluateRelease, fetchLatestRelease, runningBuild } from '../lib/utils/releases.js';

/** How often a tab checks whether the server has been redeployed. */
export const POLL_MS = 5 * 60 * 1000;

/** Build identity baked into this bundle at compile time. */
export const RUNNING_BUILD = runningBuild();

/**
 * The update-check loop.
 *
 * A web app has no installer, so the honest question is: *has this tab been
 * left behind by a deploy?* We ask the server for `release.json`, compare it
 * to the build baked into this bundle, and say so plainly.
 *
 * Checks run on mount, every 5 minutes, when the tab becomes visible again,
 * and whenever the browser reports it is back online.
 */
export function useUpdateCheck() {
  const [state, setState] = useState({
    status: 'idle',
    running: RUNNING_BUILD,
    latest: null,
    error: null,
  });
  const inFlight = useRef(false);

  const check = useCallback(async ({ silent = true } = {}) => {
    // A single in-flight check: the visibility listener and the interval can
    // easily fire together, and two racing responses could flip the banner.
    if (inFlight.current) return null;
    inFlight.current = true;
    if (!silent) {
      setState((current) => ({
        ...current,
        status: current.status === 'stale' ? 'stale' : 'checking',
      }));
    }
    try {
      const result = await fetchLatestRelease({ basePath: import.meta.env.BASE_URL });
      const evaluated = evaluateRelease({
        running: RUNNING_BUILD,
        latest: result.latest,
        ok: result.ok,
        error: result.error,
      });
      setState(evaluated);
      return evaluated;
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    check();

    const timer = setInterval(() => {
      // No point asking while the tab is hidden — a background tab polling
      // every five minutes forever is just wasted requests.
      if (document.visibilityState === 'visible') check();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    const onOnline = () => check();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [check]);

  return { ...state, check, running: RUNNING_BUILD };
}
