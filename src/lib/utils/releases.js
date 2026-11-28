/**
 * Release metadata — the small, honest core of the update checker.
 *
 * A web app has no installer, so "check for updates" means: *is the code
 * running in this tab older than the code the server is serving right now?*
 * Vite gives us that for free — every build emits a unique hash in the
 * manifest filename, so compare that against what `fetch` returns from the
 * deployed `manifest.json`.
 *
 * Everything here is pure (given a fetch result) so it can be tested without
 * a browser or a network.
 */

/** Semantic-ish comparison of two dotted version strings. */
export function compareVersions(a, b) {
  const parse = (value) =>
    String(value || '')
      .trim()
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Decide whether a freshly fetched release differs from the running build.
 *
 * Returns a result object rather than a boolean so the UI can explain itself:
 *   { status: 'same' | 'stale' | 'unknown' | 'error', ... }
 *
 * `stale`  — the server is serving a different build than this tab loaded.
 * `same`   — up to date.
 * `unknown` — the response looked like an HTML fallback (a dev server, or a
 *             host that rewrites 404s to index.html), so we cannot tell.
 */
export function evaluateRelease({ running, latest, ok = true, error = null }) {
  if (!ok) {
    return { status: 'error', running, latest: null, error, message: 'Could not reach the update server.' };
  }
  if (!latest || !latest.buildId) {
    return {
      status: 'unknown',
      running,
      latest: latest || null,
      error: null,
      message: 'The update server did not return a build we recognise.',
    };
  }
  if (running?.buildId && running.buildId === latest.buildId) {
    return { status: 'same', running, latest, error: null, message: 'You’re on the latest version.' };
  }
  const versionCompare = compareVersions(latest.version, running?.version);
  return {
    status: 'stale',
    running,
    latest,
    error: null,
    newer: versionCompare > 0,
    message:
      versionCompare > 0
        ? `Version ${latest.version} is available.`
        : 'A newer build is available.',
  };
}

/** Human label for a status, used by both the badge and the toast. */
export const RELEASE_STATUS_LABEL = {
  same: 'Up to date',
  stale: 'Update available',
  unknown: 'Unknown build',
  error: 'Check failed',
  idle: 'Not checked yet',
  checking: 'Checking…',
};

/** Format a build id for display: 6 characters is enough to disambiguate. */
export function shortBuildId(buildId) {
  if (!buildId) return 'dev';
  return String(buildId).slice(0, 6);
}

/** Format an epoch millis as a friendly relative-ish date string. */
export function formatBuildTime(millis) {
  if (!millis) return 'unknown';
  const date = new Date(Number(millis));
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Read the build identity baked in at build time.
 *
 * `__BUILD_INFO__` is injected by Vite (`define`); the fallbacks keep tests
 * and `vite dev` from blowing up when it is absent.
 */
export function runningBuild() {
  const injected =
    typeof __BUILD_INFO__ !== 'undefined' && __BUILD_INFO__ ? __BUILD_INFO__ : null;
  return {
    version: injected?.version || '0.0.0-dev',
    buildId: injected?.buildId || 'dev',
    // Nullish, not falsy: 0 is a valid (if ancient) timestamp, and silently
    // turning it into "unknown" is the kind of small lie that makes a build
    // readout useless.
    builtAt: injected?.builtAt ?? null,
  };
}

/** Filename of the deployment manifest, relative to the app's base path. */
export const RELEASE_MANIFEST = 'release.json';

/**
 * Fetch and parse the deployed release manifest.
 *
 * Cache-busting matters: an update check that reads a cached response would
 * always report "up to date", which is worse than not checking at all.
 */
export async function fetchLatestRelease({ basePath = '/', timeoutMs = 8000, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { ok: false, error: 'fetch-unavailable' };
  const url = `${String(basePath || '/').replace(/\/?$/, '/')}${RELEASE_MANIFEST}?t=${Date.now()}`;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await doFetch(url, {
      cache: 'no-store',
      signal: controller?.signal,
      headers: { accept: 'application/json' },
    });
    if (!response?.ok) return { ok: false, error: `HTTP ${response?.status ?? 'error'}` };
    // A GitHub Pages project site serves index.html for missing files; parsing
    // that as JSON throws, and `evaluateRelease` reports "unknown" — correct.
    const latest = await response.json();
    return { ok: true, latest };
  } catch (error) {
    return { ok: false, error: error?.name === 'AbortError' ? 'timeout' : error?.message || 'network' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
