import type { Profile } from '@/data/profile';

type DetailFields = Pick<Profile, 'businesses' | 'interests' | 'phone' | 'showPhone'>;

/**
 * Whether there's anything to show under "More details". His work, city and email show
 * without it.
 */
export function hasMoreDetails(profile: DetailFields): boolean {
  return (
    profile.businesses.length > 0 ||
    profile.interests.length > 0 ||
    (profile.showPhone && !!profile.phone.trim())
  );
}

/** A tel: link with just the digits, keeping a leading +. Null without enough digits. */
export function phoneUrl(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return digits.replace('+', '').length >= 7 ? `tel:${digits}` : null;
}
