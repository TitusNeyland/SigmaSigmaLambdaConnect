import { normalizeEmail, type SignUpInput } from './validation';

/**
 * The answers from the sign up in progress, kept in memory (never on disk) until the
 * profile is saved. If the account gets made but saving the profile fails, Finish your
 * profile can show these for review instead of asking for everything again. The password
 * isn't kept.
 */
export type PendingSignUp = Omit<SignUpInput, 'password'>;

let pending: PendingSignUp | null = null;

export function rememberSignUp(input: SignUpInput) {
  const { password: _password, ...rest } = input;
  pending = rest;
}

/** The remembered answers, only for the account they were for. */
export function recallSignUp(email: string | null | undefined): PendingSignUp | null {
  if (!pending || !email) return null;
  return normalizeEmail(pending.email) === normalizeEmail(email) ? pending : null;
}

export function forgetSignUp() {
  pending = null;
}
