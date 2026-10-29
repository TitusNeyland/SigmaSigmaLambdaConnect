/** Form checks for sign up and sign in. Pure, so they're easy to test. */

export const MIN_PASSWORD_LENGTH = 8;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | undefined {
  const value = normalizeEmail(email);
  if (!value) return 'Enter your email.';
  if (!EMAIL.test(value)) return 'Enter a valid email.';
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    return 'Use at least one letter and one number.';
  }
  return undefined;
}

export type SignUpInput = {
  displayName: string;
  initiationTerm: string;
  email: string;
  password: string;
};

export function validateSignUp(input: SignUpInput): FieldErrors<keyof SignUpInput> {
  const errors: FieldErrors<keyof SignUpInput> = {};
  const name = input.displayName.trim();
  if (!name) errors.displayName = 'Enter your name.';
  else if (name.length > 60) errors.displayName = 'Use 60 characters or fewer.';
  const term = input.initiationTerm.trim();
  if (!term) errors.initiationTerm = 'Enter when you were initiated, like Spring 2019.';
  else if (term.length > 40) errors.initiationTerm = 'Use 40 characters or fewer.';
  const email = validateEmail(input.email);
  if (email) errors.email = email;
  const password = validatePassword(input.password);
  if (password) errors.password = password;
  return errors;
}

export type SignInInput = { email: string; password: string };

export function validateSignIn(input: SignInInput): FieldErrors<keyof SignInInput> {
  const errors: FieldErrors<keyof SignInInput> = {};
  const email = validateEmail(input.email);
  if (email) errors.email = email;
  if (!input.password) errors.password = 'Enter your password.';
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}

/** Turns Firebase Auth error codes into plain messages. Never reveals whether an email exists. */
export function friendlyAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'That email and password don’t match.';
    case 'auth/email-already-in-use':
      return 'An account already uses that email. Try signing in.';
    case 'auth/weak-password':
      return 'Choose a stronger password.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    case 'auth/user-disabled':
      return 'This account is turned off. Contact a chapter officer.';
    default:
      return 'Something went wrong. Try again.';
  }
}
