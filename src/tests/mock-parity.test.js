import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Mock/API parity.
 *
 * A hand-written `vi.mock` factory that invents function names quietly makes a
 * test vacuous: Vitest returns `undefined` for the missing export, the app
 * throws during render, the error boundary swallows it, and the assertion
 * still passes because it only checked for the *absence* of a crash message.
 *
 * This test compares every mocked service module against the real module's
 * exports so that drift fails loudly here instead.
 */

const SERVICES = [
  'src/lib/services/userService.js',
  'src/lib/services/conversationService.js',
  'src/lib/services/messageService.js',
  'src/lib/services/storageService.js',
];

function exportedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(match[1]);
  }
  return names;
}

/** Collect the keys of a `vi.mock('<service>', () => ({ ... }))` factory. */
function mockedKeys(testSource, modulePath) {
  const marker = `vi.mock('${modulePath}'`;
  const start = testSource.indexOf(marker);
  if (start === -1) return null;
  // Walk to the matching close of the factory object literal.
  const open = testSource.indexOf('(', start);
  let depth = 0;
  let end = open;
  for (let index = open; index < testSource.length; index += 1) {
    if (testSource[index] === '(') depth += 1;
    else if (testSource[index] === ')') {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  const body = testSource.slice(start, end);
  const keys = new Set();
  for (const match of body.matchAll(/^\s{2,}([A-Za-z0-9_$]+)\s*:/gm)) {
    keys.add(match[1]);
  }
  // Returned objects may be assigned to a variable; catch `key: value,` too.
  for (const match of body.matchAll(/^\s{4,}([A-Za-z0-9_$]+)\s*:/gm)) {
    keys.add(match[1]);
  }
  return keys;
}

const testFiles = readdirSync(resolve(process.cwd(), 'src/tests'))
  .filter((name) => name.endsWith('.test.jsx') || name.endsWith('.test.js'))
  .map((name) => ({ name, source: readFileSync(resolve(process.cwd(), 'src/tests', name), 'utf8') }));

describe('service mocks match the real API', () => {
  for (const service of SERVICES) {
    const source = readFileSync(resolve(process.cwd(), service), 'utf8');
    const real = exportedNames(source);
    const modulePath = `../${service.replace(/^src\//, '')}`;

    for (const file of testFiles) {
      const mocked = mockedKeys(file.source, modulePath);
      if (!mocked) continue;

      it(`${file.name} mocks only real exports of ${service}`, () => {
        const invented = [...mocked].filter((key) => !real.has(key));
        expect(invented, `mocked names that do not exist in ${service}`).toEqual([]);
      });

      it(`${file.name} mocks every export of ${service} used at runtime`, () => {
        // Only assert the mocked module is a superset of what's imported
        // elsewhere in src (a missing export is what breaks rendering).
        const imported = new Set();
        const walk = (dir) => {
          for (const entry of readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })) {
            if (entry.name === 'tests' || entry.name.startsWith('.')) continue;
            const full = resolve(process.cwd(), dir, entry.name);
            if (entry.isDirectory()) walk(`${dir}/${entry.name}`);
            else if (/\.(js|jsx)$/.test(entry.name)) {
              const text = readFileSync(full, 'utf8');
              const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'[^']*${service.split('/').pop()}'`, 'g');
              for (const match of text.matchAll(re)) {
                for (const part of match[1].split(',')) {
                  const name = part.trim().split(/\s+as\s+/)[0].trim();
                  if (name) imported.add(name);
                }
              }
            }
          }
        };
        walk('src');

        const missing = [...imported].filter((name) => !mocked.has(name));
        expect(missing, `exports used in src but absent from the ${file.name} mock`).toEqual([]);
      });
    }
  }
});
