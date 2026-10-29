import { toAuthState } from './AuthProvider';

jest.mock('@/data/auth');

const user = { uid: 'u1', email: 'a@example.com', displayName: 'A', emailVerified: true };

describe('toAuthState', () => {
  it('is signed out with no user', () => {
    expect(toAuthState(null)).toEqual({ status: 'signedOut', user: null });
  });

  it('is unverified until the email link is tapped', () => {
    expect(toAuthState({ ...user, emailVerified: false }).status).toBe('unverified');
  });

  it('is signed in once verified', () => {
    expect(toAuthState(user)).toEqual({ status: 'signedIn', user });
  });
});
