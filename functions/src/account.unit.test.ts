import { describe, expect, it } from 'vitest';

import { isRecentLogin, RECENT_LOGIN_SECONDS } from './account';

describe('isRecentLogin', () => {
  const now = 1_800_000_000_000;
  const seconds = now / 1000;

  it('accepts a sign-in within the last five minutes', () => {
    expect(isRecentLogin(seconds - 10, now)).toBe(true);
    expect(isRecentLogin(seconds - RECENT_LOGIN_SECONDS, now)).toBe(true);
  });

  it('rejects an older sign-in', () => {
    expect(isRecentLogin(seconds - RECENT_LOGIN_SECONDS - 1, now)).toBe(false);
  });

  it('rejects a token with no sign-in time', () => {
    expect(isRecentLogin(undefined, now)).toBe(false);
  });
});
