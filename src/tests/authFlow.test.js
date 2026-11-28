import { describe, expect, it } from 'vitest';
import { AUTH_STATES, resolveAuthState, linkGuidance, onboardingDefaults, needsEmailVerification } from '../lib/services/authFlow.js';

const user = { uid: 'u1', email: 'ada@example.com', displayName: 'Ada Lovelace', providerData: [] };

describe('resolveAuthState', () => {
  it('sends anonymous visitors to signedOut', () => {
    expect(resolveAuthState({ user: null, profile: null }).state).toBe(AUTH_STATES.signedOut);
  });

  it('sends signed-in users without a profile to onboarding', () => {
    expect(resolveAuthState({ user, profile: null })).toEqual({
      state: AUTH_STATES.needsProfile,
      reason: 'no-profile',
    });
  });

  it('treats an incomplete profile as onboarding', () => {
    expect(resolveAuthState({ user, profile: { onboardingComplete: false } }).state).toBe(
      AUTH_STATES.needsProfile,
    );
  });

  it('lets a complete profile through', () => {
    expect(resolveAuthState({ user, profile: { onboardingComplete: true } }).state).toBe(AUTH_STATES.ready);
  });

  it('blocks suspended accounts from the app surface', () => {
    const result = resolveAuthState({
      user,
      profile: { onboardingComplete: true, suspended: true },
    });
    expect(result).toEqual({ state: AUTH_STATES.signedOut, reason: 'suspended' });
  });
});

describe('linkGuidance', () => {
  it('never auto-merges when a password account exists', () => {
    const guidance = linkGuidance(['password']);
    expect(guidance.action).toBe('sign-in-with-password');
    expect(guidance.message).toMatch(/password/i);
  });

  it('recognises Google-only accounts', () => {
    expect(linkGuidance(['google.com']).action).toBe('sign-in-with-provider');
  });

  it('recognises accounts with both methods', () => {
    expect(linkGuidance(['google.com', 'password']).action).toBe('signed-in-either-way');
  });
});

describe('onboardingDefaults', () => {
  it('prefers the Google profile when present', () => {
    const googleUser = {
      displayName: null,
      email: 'ada@example.com',
      photoURL: null,
      providerData: [
        { providerId: 'google.com', displayName: 'Ada L', photoURL: 'https://example.com/a.png' },
      ],
    };
    expect(onboardingDefaults(googleUser)).toEqual({
      displayName: 'Ada L',
      email: 'ada@example.com',
      photoURL: 'https://example.com/a.png',
    });
  });

  it('is safe with no user', () => {
    expect(onboardingDefaults(null)).toEqual({ displayName: '', email: '', photoURL: '' });
  });
});

describe('needsEmailVerification', () => {
  it('only prompts password accounts', () => {
    expect(needsEmailVerification({ providerData: [{ providerId: 'password' }], emailVerified: false })).toBe(true);
    expect(needsEmailVerification({ providerData: [{ providerId: 'password' }], emailVerified: true })).toBe(false);
    expect(needsEmailVerification({ providerData: [{ providerId: 'google.com' }], emailVerified: false })).toBe(false);
  });
});
