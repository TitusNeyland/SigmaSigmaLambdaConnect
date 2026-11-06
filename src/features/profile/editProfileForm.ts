import type { Profile, ProfilePatch } from '@/data/profile';
import { LIMITS } from '@/data/types';
import { validateProfile, type FieldErrors } from '@/features/auth/validation';

export { addInterest, MAX_INTEREST_LENGTH, MAX_INTERESTS } from './aboutYou';
const MAX_PHONE = 30;

export type EditProfileForm = ProfilePatch;

export function formFromProfile(profile: Profile): EditProfileForm {
  return {
    displayName: profile.displayName,
    initiationTerm: profile.initiationTerm,
    initiationDate: profile.initiationDate,
    headline: profile.headline,
    industry: profile.industry,
    businesses: profile.businesses,
    bio: profile.bio,
    interests: profile.interests,
    phone: profile.phone,
    showEmail: profile.showEmail,
    showPhone: profile.showPhone,
  };
}

/** Trims every text field and drops the phone switch if there's no phone to show. */
export function normalizeForm(form: EditProfileForm): EditProfileForm {
  const phone = form.phone.trim();
  return {
    displayName: form.displayName.trim(),
    initiationTerm: form.initiationTerm.trim(),
    initiationDate: form.initiationDate,
    headline: form.headline.trim(),
    industry: form.industry.trim(),
    businesses: form.businesses.map((b) => b.trim()).filter(Boolean),
    bio: form.bio.trim(),
    interests: form.interests.map((i) => i.trim()).filter(Boolean),
    phone,
    showEmail: form.showEmail,
    showPhone: phone ? form.showPhone : false,
  };
}

export type EditProfileErrors = FieldErrors<
  'displayName' | 'initiationTerm' | 'initiationDate' | 'headline' | 'bio' | 'phone'
>;

const SEASON_MONTH: Record<string, number> = { spring: 2, summer: 5, fall: 9, winter: 0 };

/**
 * A starting point for the initiation date picker, from a term like "Fall 2021": the first
 * of that season's usual month. Today if the term doesn't say.
 */
export function dateFromTerm(term: string, today = new Date()): Date {
  const match = /(spring|summer|fall|winter)\s+(\d{4})/i.exec(term);
  if (!match) return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return new Date(Number(match[2]), SEASON_MONTH[match[1].toLowerCase()], 1);
}

/** Digits with common separators, 7 to 15 digits long. */
export function isPhoneNumber(value: string): boolean {
  if (!/^\+?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15;
}

/** Same limits as the security rules, so a save never fails on validation. */
export function validateEditProfile(form: EditProfileForm): EditProfileErrors {
  const errors: EditProfileErrors = { ...validateProfile(form) };
  if (form.headline.trim().length > LIMITS.headline) {
    errors.headline = `Use ${LIMITS.headline} characters or fewer.`;
  }
  if (form.bio.trim().length > LIMITS.bio) errors.bio = `Use ${LIMITS.bio} characters or fewer.`;
  if (form.initiationDate && form.initiationDate.getTime() > Date.now()) {
    errors.initiationDate = 'Pick a day that’s already happened.';
  }
  const phone = form.phone.trim();
  if (phone.length > MAX_PHONE) errors.phone = `Use ${MAX_PHONE} characters or fewer.`;
  else if (phone && !isPhoneNumber(phone)) {
    errors.phone = 'Enter a phone number, like (555) 123-4567.';
  }
  return errors;
}

export function isDirty(original: EditProfileForm, current: EditProfileForm): boolean {
  return JSON.stringify(normalizeForm(original)) !== JSON.stringify(normalizeForm(current));
}
