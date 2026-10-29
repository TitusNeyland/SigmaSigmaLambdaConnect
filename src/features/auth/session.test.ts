import { routeForStatus } from './routes';
import { toSessionStatus, type SessionStatus } from './session';

jest.mock('@/data/members');
jest.mock('@/data/auth');

const member = (status: 'pending' | 'approved' | 'declined') => ({
  displayName: 'Marcus Reed',
  initiationTerm: 'Spring 2019',
  status,
});

describe('toSessionStatus', () => {
  it.each(['loading', 'signedOut', 'unverified'] as const)(
    'passes %s through without looking at the profile',
    (auth) => {
      expect(toSessionStatus(auth, member('approved'))).toBe(auth);
    },
  );

  it('is loading while the profile loads', () => {
    expect(toSessionStatus('signedIn', undefined)).toBe('loading');
  });

  it('is an error if the profile could not load', () => {
    expect(toSessionStatus('signedIn', undefined, true)).toBe('error');
  });

  it('needs a profile when none was saved', () => {
    expect(toSessionStatus('signedIn', null)).toBe('needsProfile');
  });

  it.each(['pending', 'approved', 'declined'] as const)('uses the profile status %s', (s) => {
    expect(toSessionStatus('signedIn', member(s))).toBe(s);
  });

  it('a loaded profile wins over an earlier error', () => {
    expect(toSessionStatus('signedIn', member('approved'), true)).toBe('approved');
  });
});

describe('routeForStatus', () => {
  const cases: [Exclude<SessionStatus, 'loading'>, string][] = [
    ['signedOut', '/welcome'],
    ['unverified', '/verify-email'],
    ['needsProfile', '/complete-profile'],
    ['pending', '/pending'],
    ['declined', '/declined'],
    ['error', '/offline'],
    ['approved', '/home'],
  ];

  it.each(cases)('%s goes to %s', (status, route) => {
    expect(routeForStatus(status)).toBe(route);
  });

  it('only approved members are sent into the tabs', () => {
    for (const [status, route] of cases) {
      expect(route === '/home').toBe(status === 'approved');
    }
  });
});
