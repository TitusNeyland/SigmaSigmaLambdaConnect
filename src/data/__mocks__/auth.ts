/**
 * Test double for src/data/auth.ts. Use it with `jest.mock('@/data/auth')`, then control who
 * is signed in with `setMockUser`.
 */
import type { AuthUser } from '../auth';

let current: AuthUser | null = null;
const listeners = new Set<(user: AuthUser | null) => void>();

export function setMockUser(user: AuthUser | null) {
  current = user;
  for (const listener of listeners) listener(user);
}

export function sampleUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    uid: 'sample-marcus',
    email: 'sample-marcus@example.com',
    emailVerified: true,
    displayName: 'Marcus Reed',
    ...overrides,
  };
}

export const subscribeToAuth = jest.fn((callback: (user: AuthUser | null) => void) => {
  listeners.add(callback);
  callback(current);
  return () => listeners.delete(callback);
});

export const signUp = jest.fn(async () => {});
export const signIn = jest.fn(async () => {});
export const signOut = jest.fn(async () => {
  setMockUser(null);
});

export function resetAuthMock() {
  current = null;
  listeners.clear();
  subscribeToAuth.mockClear();
  signUp.mockReset().mockResolvedValue(undefined);
  signIn.mockReset().mockResolvedValue(undefined);
  signOut.mockClear();
}
