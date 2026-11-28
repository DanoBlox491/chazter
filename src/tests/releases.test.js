import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  evaluateRelease,
  fetchLatestRelease,
  formatBuildTime,
  runningBuild,
  shortBuildId,
} from '../lib/utils/releases.js';

const running = { version: '1.0.0', buildId: 'abc12345', builtAt: 1 };

describe('compareVersions', () => {
  it('orders dotted versions numerically, not lexically', () => {
    // The classic bug: '1.10.0' < '1.9.0' as strings.
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
  });

  it('treats equal versions as equal, including missing segments', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('v2.0.0', '2.0.0')).toBe(0);
  });

  it('does not throw on junk', () => {
    expect(() => compareVersions(null, undefined)).not.toThrow();
    expect(compareVersions('garbage', '0.0.0')).toBe(0);
  });
});

describe('evaluateRelease', () => {
  it('reports "same" when the build id matches', () => {
    const result = evaluateRelease({ running, latest: { version: '1.0.0', buildId: 'abc12345' } });
    expect(result.status).toBe('same');
    expect(result.message).toMatch(/latest version/i);
  });

  it('reports "stale" when the server has a different build', () => {
    const result = evaluateRelease({ running, latest: { version: '1.1.0', buildId: 'def67890' } });
    expect(result.status).toBe('stale');
    expect(result.newer).toBe(true);
    expect(result.message).toContain('1.1.0');
  });

  it('flags a different build even when the version number is unchanged', () => {
    // A hotfix deploy without a version bump must still be offered.
    const result = evaluateRelease({ running, latest: { version: '1.0.0', buildId: 'zzz99999' } });
    expect(result.status).toBe('stale');
    expect(result.newer).toBe(false);
    expect(result.message).toMatch(/newer build/i);
  });

  it('does not claim an update when the fetch failed', () => {
    const result = evaluateRelease({ running, ok: false, error: 'timeout' });
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/could not reach/i);
  });

  it('reports "unknown" for an HTML fallback instead of a manifest', () => {
    // GitHub Pages serves index.html for missing files; JSON.parse throws and
    // the caller passes the failure through, but a null body must not read as
    // "you are up to date".
    const result = evaluateRelease({ running, latest: null, ok: true });
    expect(result.status).toBe('unknown');
    expect(result.status).not.toBe('same');
  });
});

describe('fetchLatestRelease', () => {
  it('requests the manifest under the base path with cache busting', async () => {
    let requested = '';
    const result = await fetchLatestRelease({
      basePath: '/chazter/',
      fetchImpl: async (url) => {
        requested = url;
        return { ok: true, json: async () => ({ version: '2.0.0', buildId: 'new' }) };
      },
    });
    expect(requested).toMatch(/^\/chazter\/release\.json\?t=\d+$/);
    expect(result.ok).toBe(true);
    expect(result.latest.buildId).toBe('new');
  });

  it('never sends the browser cache', async () => {
    let init = null;
    await fetchLatestRelease({
      fetchImpl: async (_url, options) => {
        init = options;
        return { ok: true, json: async () => ({ buildId: 'x' }) };
      },
    });
    expect(init.cache).toBe('no-store');
  });

  it('returns a failure object instead of throwing on a 404', async () => {
    const result = await fetchLatestRelease({
      fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('404');
  });

  it('returns a failure object instead of throwing on bad JSON', async () => {
    const result = await fetchLatestRelease({
      fetchImpl: async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      }),
    });
    expect(result.ok).toBe(false);
  });

  it('times out rather than hanging forever', async () => {
    const result = await fetchLatestRelease({
      timeoutMs: 10,
      fetchImpl: (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    });
    expect(result).toEqual({ ok: false, error: 'timeout' });
  });
});

describe('display helpers', () => {
  it('shortens build ids and labels a missing one as dev', () => {
    expect(shortBuildId('abcdef123456')).toBe('abcdef');
    expect(shortBuildId('')).toBe('dev');
    expect(shortBuildId(undefined)).toBe('dev');
  });

  it('formats a build time, and says so when it is unknown', () => {
    expect(formatBuildTime(null)).toBe('unknown');
    expect(formatBuildTime('not-a-number')).toBe('unknown');
    expect(formatBuildTime(1795875737675)).toMatch(/\d{4}/);
  });
});

describe('runningBuild', () => {
  it('reads the build identity injected at compile time', () => {
    // vite.config.js defines this for both builds and tests.
    expect(runningBuild()).toEqual({
      version: '1.0.0',
      buildId: 'test-build',
      builtAt: 0,
    });
  });
});
