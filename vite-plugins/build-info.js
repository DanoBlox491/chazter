/**
 * Release identity for the update checker.
 *
 * Every build produces two things:
 *   1. `__BUILD_INFO__` — compiled into the bundle (`define`), so a running
 *      tab can state exactly which build it is.
 *   2. `dist/release.json` — so a running tab can fetch what the server is
 *      currently serving and compare the two.
 *
 * The id is the git commit, because that is genuinely the identity of the
 * code: rebuilding the same commit produces the same id (no false "update
 * available"), and any commit produces a different one (no false "up to
 * date"). Hashing the bundle output instead would be circular — the id would
 * have to be inside the very thing being hashed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function git(root, args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function resolveBuildId(root) {
  const sha = git(root, ['rev-parse', '--short=8', 'HEAD']);
  if (!sha) return 'dev';
  // Uncommitted changes are a real, distinct build — say so rather than
  // pretending the deployed code equals the commit.
  return git(root, ['status', '--porcelain']) ? `${sha}-dirty` : sha;
}

function readVersion(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * @param {{ releaseNotes?: string[], buildId?: string }} options
 *   `buildId` overrides the git-derived id (useful in CI or tests).
 */
export function buildInfoPlugin({ releaseNotes = [], buildId: forcedId } = {}) {
  const info = { version: '0.0.0', buildId: 'dev', builtAt: null, notes: [] };
  let outDir = null;

  return {
    name: 'chazter-release-info',
    apply: 'build',

    configResolved(config) {
      info.version = readVersion(config.root);
      info.buildId = forcedId || resolveBuildId(config.root);
      info.builtAt = Date.now();
      info.notes = releaseNotes.slice(0, 12);
      outDir = config.build?.outDir
        ? join(config.root, config.build.outDir)
        : join(config.root, 'dist');
    },

    config(config) {
      const root = config.root || process.cwd();
      const injected = {
        version: readVersion(root),
        buildId: forcedId || resolveBuildId(root),
        builtAt: Date.now(),
      };
      // `define` values must be JSON — this becomes a literal in the bundle.
      return { define: { ...(config.define || {}), __BUILD_INFO__: JSON.stringify(injected) } };
    },

    closeBundle() {
      if (!outDir) return;
      try {
        writeFileSync(
          join(outDir, 'release.json'),
          JSON.stringify(
            {
              version: info.version,
              buildId: info.buildId,
              builtAt: info.builtAt,
              notes: info.notes,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        this.warn(`could not write release.json: ${error.message}`);
      }
    },
  };
}
