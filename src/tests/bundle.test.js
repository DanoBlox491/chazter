import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Production bundle integrity.
 *
 * Chazter once shipped a blank page because the dependency tree contained two
 * copies of `@firebase/app`. Each copy owns its own component registry, so
 * `getAuth()` consulted a registry that `@firebase/auth` had never registered
 * into, and the app threw "Component auth has not been registered yet" before
 * React could mount.
 *
 * These tests guard the two conditions that caused it:
 *   1. exactly one `@firebase/app` must exist in node_modules;
 *   2. the built bundle must contain exactly one component registry.
 */

const root = process.cwd();
const nodeModules = resolve(root, 'node_modules');

function findPackageJson(dir, target, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // Do not descend forever; @firebase/app lives at a known depth.
    const full = resolve(dir, entry.name);
    if (entry.name === 'app' && full.includes('@firebase')) {
      const pkg = resolve(full, 'package.json');
      if (existsSync(pkg)) found.push(pkg);
      continue;
    }
    if (entry.name === '.bin' || entry.name === '.cache') continue;
    const depth = full.split('node_modules').length;
    if (depth > 5) continue;
    findPackageJson(full, target, found);
  }
  return found;
}

describe('dependency tree', () => {
  it('has exactly one copy of @firebase/app', () => {
    const copies = findPackageJson(resolve(nodeModules, '@firebase'), 'app');
    const versions = copies.map((pkg) => JSON.parse(readFileSync(pkg, 'utf8')).version);
    // Two copies = two component registries = "Component auth has not been registered yet".
    expect(copies, `found ${copies.length} copies:\n${copies.join('\n')}`).toHaveLength(1);
    expect(versions).toHaveLength(1);
  });

  it('resolves the @firebase/app version firebase itself expects', () => {
    const firebasePkg = JSON.parse(readFileSync(resolve(nodeModules, 'firebase/package.json'), 'utf8'));
    const appPkg = JSON.parse(readFileSync(resolve(nodeModules, '@firebase/app/package.json'), 'utf8'));
    // `firebase` pins an exact @firebase/app; a hoisted version that differs
    // from it is what produced the duplicate registries.
    expect(appPkg.version).toBe(firebasePkg.dependencies['@firebase/app']);
  });
});

describe('production bundle', () => {
  const outDir = resolve(root, 'dist-bundle-test');

  it('builds and exposes exactly one component registry', () => {
    rmSync(outDir, { recursive: true, force: true });

    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-bundle-test'], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, VITE_BASE_PATH: '/' },
    });

    const assetsDir = resolve(outDir, 'assets');
    expect(existsSync(assetsDir)).toBe(true);

    const jsFiles = readdirSync(assetsDir).filter((file) => file.endsWith('.js'));
    expect(jsFiles.length).toBeGreaterThan(0);

    let registryCopies = 0;
    for (const file of jsFiles) {
      const source = readFileSync(resolve(assetsDir, file), 'utf8');
      const occurrences = source.split('has not been registered').length - 1;
      registryCopies += occurrences;
    }

    // The bundler must not have duplicated @firebase/app's registry.
    expect(registryCopies, 'duplicate @firebase/app registries in the bundle').toBe(1);

    const totalBytes = jsFiles.reduce((sum, file) => sum + statSync(resolve(assetsDir, file)).size, 0);
    expect(totalBytes).toBeGreaterThan(0);

    rmSync(outDir, { recursive: true, force: true });
  }, 120_000);
});
