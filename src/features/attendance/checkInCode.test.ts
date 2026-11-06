import { checkInCode, readCheckInCode, scanCheckIn, scanMessage } from './checkInCode';

const members = [
  { uid: 'ace', displayName: 'Sample Ace' },
  { uid: 'bee', displayName: 'Sample Bee' },
];

describe('check-in codes', () => {
  it('round-trips a member ID, and ignores anything else', () => {
    expect(readCheckInCode(checkInCode('ace'))).toBe('ace');
    expect(readCheckInCode(` ${checkInCode('a-B_9')} `)).toBe('a-B_9');
    expect(readCheckInCode('https://example.com')).toBeNull();
    expect(readCheckInCode('sslconnect:checkin:')).toBeNull();
    expect(readCheckInCode('sslconnect:checkin:a/b')).toBeNull();
  });

  it('checks a brother on the roster once, and says why it can’t otherwise', () => {
    expect(scanCheckIn(checkInCode('ace'), members, new Set())).toEqual({
      kind: 'added',
      uid: 'ace',
      name: 'Sample Ace',
    });
    expect(scanCheckIn(checkInCode('bee'), members, new Set(['bee']))).toEqual({
      kind: 'already',
      name: 'Sample Bee',
    });
    expect(scanCheckIn(checkInCode('zed'), members, new Set())).toEqual({ kind: 'unknown' });
    expect(scanCheckIn('hello', members, new Set())).toEqual({ kind: 'invalid' });
  });

  it('tells the officer what happened', () => {
    expect(scanMessage({ kind: 'added', uid: 'ace', name: 'Sample Ace' })).toBe(
      "Sample Ace is checked. Save when you're done.",
    );
    expect(scanMessage({ kind: 'already', name: 'Sample Bee' })).toBe(
      'Sample Bee is already checked.',
    );
    expect(scanMessage({ kind: 'unknown' })).toMatch(/approved brother/);
    expect(scanMessage({ kind: 'invalid' })).toMatch(/check-in code/);
  });
});
