import type { Profile, ProfilePatch } from '@/data/profile';
import { LIMITS } from '@/data/types';
import { validateProfile, type FieldErrors } from '@/features/auth/validation';

export const MAX_INTERESTS = 10;
export const MAX_INTEREST_LENGTH = 30;
const MAX_PHONE = 30;

export type EditProfileForm = ProfilePatch;

export function formFromProfile(profile: Profile): EditProfileForm {
  return {
    displayName: profile.displayName,
    initiationTerm: profile.initiationTerm,
    headline: profile.headline,
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
    headline: form.headline.trim(),
    bio: form.bio.trim(),
    interests: form.interests.map((i) => i.trim()).filter(Boolean),
    phone,
    showEmail: form.showEmail,
    showPhone: phone ? form.showPhone : false,
  };
}

export type EditProfileErrors = FieldErrors<
  'displayName' | 'initiationTerm' | 'headline' | 'bio' | 'phone'
>;

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
  const phone = form.phone.trim();
  if (phone.length > MAX_PHONE) errors.phone = `Use ${MAX_PHONE} characters or fewer.`;
  else if (phone && !isPhoneNumber(phone)) {
    errors.phone = 'Enter a phone number, like (555) 123-4567.';
  }
  return errors;
}

/**
 * Adds an interest typed by the member. Returns the new list, or an error message if it
 * can't be added (empty, too long, duplicate, or the list is full).
 */
export function addInterest(
  interests: string[],
  raw: string,
): { interests: string[] } | { error: string } {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (!value) return { error: 'Type an interest first.' };
  if (value.length > MAX_INTEREST_LENGTH) {
    return { error: `Keep each interest to ${MAX_INTEREST_LENGTH} characters.` };
  }
  if (interests.some((i) => i.toLowerCase() === value.toLowerCase())) {
    return { error: 'You already added that.' };
  }
  if (interests.length >= MAX_INTERESTS) return { error: `You can add up to ${MAX_INTERESTS}.` };
  return { interests: [...interests, value] };
}

export function isDirty(original: EditProfileForm, current: EditProfileForm): boolean {
  return JSON.stringify(normalizeForm(original)) !== JSON.stringify(normalizeForm(current));
}
