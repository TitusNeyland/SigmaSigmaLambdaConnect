import {
  friendlyAuthError,
  hasErrors,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateSignIn,
  validateSignUp,
} from './validation';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Marcus@Example.COM ')).toBe('marcus@example.com');
  });
});

describe('validateEmail', () => {
  it.each(['marcus@example.com', ' Marcus@Example.com ', 'a.b+c@sub.example.org'])(
    'accepts %p',
    (email) => expect(validateEmail(email)).toBeUndefined(),
  );

  it('asks for an email when empty', () => {
    expect(validateEmail('   ')).toBe('Enter your email.');
  });

  it.each(['marcus', 'marcus@', '@example.com', 'marcus@example', 'mar cus@example.com'])(
    'rejects %p',
    (email) => expect(validateEmail(email)).toBe('Enter a valid email.'),
  );
});

describe('validatePassword', () => {
  it('accepts a password with letters and numbers', () => {
    expect(validatePassword('brother2019')).toBeUndefined();
  });

  it('asks for a password when empty', () => {
    expect(validatePassword('')).toBe('Enter a password.');
  });

  it(`needs at least ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(validatePassword('abc1234')).toMatch(/at least 8/);
    expect(validatePassword('abcd1234')).toBeUndefined();
  });

  it('needs a letter and a number', () => {
    expect(validatePassword('abcdefgh')).toMatch(/letter and one number/);
    expect(validatePassword('12345678')).toMatch(/letter and one number/);
  });
});

describe('validateSignUp', () => {
  const valid = {
    displayName: 'Marcus Reed',
    initiationTerm: 'Spring 2019',
    email: 'marcus@example.com',
    password: 'brother2019',
  };

  it('passes a complete form', () => {
    expect(validateSignUp(valid)).toEqual({});
    expect(hasErrors(validateSignUp(valid))).toBe(false);
  });

  it('flags every missing field', () => {
    const errors = validateSignUp({
      displayName: ' ',
      initiationTerm: '',
      email: '',
      password: '',
    });
    expect(Object.keys(errors).sort()).toEqual([
      'displayName',
      'email',
      'initiationTerm',
      'password',
    ]);
    expect(hasErrors(errors)).toBe(true);
  });

  it('matches the length limits in the security rules', () => {
    expect(validateSignUp({ ...valid, displayName: 'a'.repeat(61) }).displayName).toMatch(/60/);
    expect(validateSignUp({ ...valid, displayName: 'a'.repeat(60) }).displayName).toBeUndefined();
    expect(validateSignUp({ ...valid, initiationTerm: 'a'.repeat(41) }).initiationTerm).toMatch(
      /40/,
    );
  });

  it('explains what the initiation field wants', () => {
    expect(validateSignUp({ ...valid, initiationTerm: '' }).initiationTerm).toMatch(/Spring 2019/);
  });
});

describe('validateSignIn', () => {
  it('only checks that a password was entered, not its strength', () => {
    expect(validateSignIn({ email: 'marcus@example.com', password: 'x' })).toEqual({});
    expect(validateSignIn({ email: 'marcus@example.com', password: '' }).password).toBeDefined();
  });

  it('checks the email', () => {
    expect(validateSignIn({ email: 'nope', password: 'x' }).email).toBe('Enter a valid email.');
  });
});

describe('friendlyAuthError', () => {
  it('uses the same message for wrong password and unknown email, so accounts stay private', () => {
    const wrongPassword = friendlyAuthError({ code: 'auth/wrong-password' });
    expect(friendlyAuthError({ code: 'auth/user-not-found' })).toBe(wrongPassword);
    expect(friendlyAuthError({ code: 'auth/invalid-credential' })).toBe(wrongPassword);
  });

  it.each([
    ['auth/email-already-in-use', /already uses that email/],
    ['auth/weak-password', /stronger password/],
    ['auth/too-many-requests', /Too many tries/],
    ['auth/network-request-failed', /No connection/],
    ['auth/user-disabled', /officer/],
  ])('%s has a plain message', (code, message) => {
    expect(friendlyAuthError({ code })).toMatch(message);
  });

  it.each([new Error('boom'), 'oops', null, undefined, { code: 'auth/unknown-thing' }])(
    'falls back to a generic message for %p',
    (error) => expect(friendlyAuthError(error)).toBe('Something went wrong. Try again.'),
  );
});
