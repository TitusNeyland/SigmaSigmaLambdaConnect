/**
 * Sign up, one question at a time, like a native app's onboarding: name, when he was
 * initiated, a little about him (work, businesses, interests, a photo; each skippable),
 * email and a password, then a review of it all before the account is made. Pure, so each
 * step's check is easy to test.
 */
import { LIMITS } from '@/data/types';

import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
  validateProfile,
  type SignUpInput,
} from './validation';

export const SIGN_UP_STEPS = [
  'name',
  'initiated',
  'work',
  'business',
  'interests',
  'photo',
  'email',
  'password',
  'review',
] as const;
export type SignUpStep = (typeof SIGN_UP_STEPS)[number];

/**
 * Finishing a profile for an account that already exists (sign up was cut off before the
 * profile saved): the same steps, minus email and password.
 */
export const FINISH_STEPS: readonly SignUpStep[] = SIGN_UP_STEPS.filter(
  (step) => step !== 'email' && step !== 'password',
);

/** The About you steps. He can skip any of them and add it later in Edit profile. */
export const OPTIONAL_STEPS: readonly SignUpStep[] = ['work', 'business', 'interests', 'photo'];

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
export type Season = (typeof SEASONS)[number];

/** Alpha Phi Alpha was founded in 1906, so no one crossed before then. */
export const FIRST_YEAR = 1906;

/** What's typed so far. The term is picked as a season and a year. */
export type SignUpDraft = {
  displayName: string;
  season: Season | null;
  year: string;
  /** Job title, saved as his headline. */
  headline: string;
  industry: string;
  businesses: string[];
  interests: string[];
  /** A cropped profile photo on the phone, uploaded once the account exists. */
  photoUri: string | null;
  email: string;
  password: string;
};

export const EMPTY_DRAFT: SignUpDraft = {
  displayName: '',
  season: null,
  year: '',
  headline: '',
  industry: '',
  businesses: [],
  interests: [],
  photoUri: null,
  email: '',
  password: '',
};

/** "Spring 2019", the initiation term as profiles show it. */
export const termOf = (season: Season | null, year: string) =>
  season ? `${season} ${year.trim()}` : '';

export function validateYear(year: string, now: Date): string | undefined {
  const value = year.trim();
  if (!/^\d{4}$/.test(value)) return 'Enter the year, like 2019.';
  const n = Number(value);
  if (n < FIRST_YEAR || n > now.getFullYear()) {
    return `Enter a year from ${FIRST_YEAR} to ${now.getFullYear()}.`;
  }
  return undefined;
}

/** What's wrong on a step, if anything, so Continue can say so instead of moving on. */
export function stepError(
  step: SignUpStep,
  draft: SignUpDraft,
  now: Date,
  steps: readonly SignUpStep[] = SIGN_UP_STEPS,
): string | undefined {
  switch (step) {
    case 'name':
      return validateProfile({ displayName: draft.displayName, initiationTerm: 'x' }).displayName;
    case 'initiated':
      if (!draft.season) return 'Pick the season you crossed.';
      return validateYear(draft.year, now);
    case 'work':
      return draft.headline.trim().length > LIMITS.headline
        ? `Use ${LIMITS.headline} characters or fewer.`
        : undefined;
    case 'business':
    case 'interests':
    case 'photo':
      return undefined;
    case 'email':
      return validateEmail(draft.email);
    case 'password':
      return validatePassword(draft.password);
    case 'review':
      return steps
        .filter((st) => st !== 'review')
        .map((st) => stepError(st, draft, now, steps))
        .find(Boolean);
  }
}

/** The account to create, once every step is done. */
export function toSignUpInput(draft: SignUpDraft): SignUpInput {
  const about = {
    headline: draft.headline.trim(),
    industry: draft.industry.trim(),
    businesses: draft.businesses,
    interests: draft.interests,
  };
  const shared =
    about.headline || about.industry || about.businesses.length || about.interests.length;
  return {
    displayName: draft.displayName.trim(),
    initiationTerm: termOf(draft.season, draft.year),
    email: draft.email,
    password: draft.password,
    ...(shared ? { about } : {}),
    ...(draft.photoUri ? { photoUri: draft.photoUri } : {}),
  };
}

/** The password rules, each ticked off live as he types. */
export function passwordChecks(password: string): { label: string; met: boolean }[] {
  return [
    {
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
    { label: 'A letter', met: /[a-z]/i.test(password) },
    { label: 'A number', met: /\d/.test(password) },
  ];
}
