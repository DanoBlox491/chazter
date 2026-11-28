/** Avatar palette keys, shared with the CSS `avatar--<tone>` classes. */
export const AVATAR_COLOURS = ['jade', 'coral', 'plum', 'amber', 'sky', 'clay'];

/** Deterministic colour from any string, so a person keeps their colour. */
export function colourFor(seed = '') {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  }
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}
