import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Design-token accessibility gate.
 *
 * Parses tokens.css and asserts WCAG AA contrast (4.5:1) for every
 * text token used on the app's surfaces, in BOTH themes. Prevents a future
 * palette tweak from silently making Chazter unreadable.
 */

const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function themeBlock(marker) {
  const start = css.indexOf(marker);
  expect(start, `theme block not found: ${marker}`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open, index);
    }
  }
  throw new Error('unbalanced theme block');
}

function tokens(block) {
  const pairs = {};
  for (const match of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    pairs[match[1]] = match[2];
  }
  return pairs;
}

const luminance = (hex) => {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrast = (foreground, background) => {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const themes = {
  dark: tokens(themeBlock('Dark theme (default)')),
  light: tokens(themeBlock('Light theme')),
};

// Text/surface pairings that actually occur in the UI.
const PAIRS = [
  ['--text-primary', '--bg-app'],
  ['--text-primary', '--bg-panel'],
  ['--text-secondary', '--bg-app'],
  ['--text-secondary', '--bg-panel'],
  ['--text-tertiary', '--bg-app'],
  ['--text-tertiary', '--bg-panel'],
  ['--text-tertiary', '--bg-inset'],
  ['--accent-text', '--bg-app'],
  ['--accent-text', '--bg-panel'],
  ['--accent-text', '--bg-inset'],
  ['--danger', '--bg-panel'],
  ['--danger', '--bg-app'],
  ['--success', '--bg-panel'],
  ['--bubble-incoming-text', '--bubble-incoming'],
  ['--bubble-outgoing-text', '--bubble-outgoing'],
];

describe.each(Object.entries(themes))('%s theme', (_name, theme) => {
  it('defines every token the UI relies on', () => {
    for (const [foreground, background] of PAIRS) {
      expect(theme[foreground], `${foreground} missing`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme[background], `${background} missing`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(PAIRS)('keeps %s readable on %s (>= 4.5:1)', (foreground, background) => {
    const ratio = contrast(theme[foreground], theme[background]);
    expect(ratio, `${foreground} on ${background} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps primary text at AAA on the main surface', () => {
    expect(contrast(theme['--text-primary'], theme['--bg-app'])).toBeGreaterThanOrEqual(7);
  });

  it('separates surfaces enough to read card boundaries', () => {
    // Surfaces should not be identical, or panels become invisible.
    expect(theme['--bg-app']).not.toBe(theme['--bg-panel']);
    expect(theme['--bg-panel']).not.toBe(theme['--bg-inset']);
  });
});

describe('theme switching', () => {
  it('exposes distinct light and dark values for every surface', () => {
    for (const token of ['--bg-app', '--bg-panel', '--bg-raised', '--text-primary']) {
      expect(themes.dark[token]).not.toBe(themes.light[token]);
    }
  });
});
