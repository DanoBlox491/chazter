/**
 * Release notes shown in the in-app update panel.
 *
 * These ship inside `release.json` with the build, so a running tab can show
 * what the new version contains *before* reloading into it. Keep entries
 * user-facing and short — "what changed for me", never a changelog of commits.
 */
export const RELEASE_NOTES = [
  'Performance settings: launch acceleration, low latency profile and a real reduce-motion switch.',
  'Update checker — Chazter now tells you when a newer build has been published.',
  'New About tab showing exactly which build you are running.',
];
