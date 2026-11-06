/**
 * What brothers share about their work and life, asked in sign up and changed in Edit
 * profile: industry, job title (the headline), businesses they own and interests. Pure, so
 * it's easy to test. Limits match the security rules.
 */
import { LIMITS } from '@/data/types';

export const MAX_BUSINESSES = LIMITS.businesses;
export const MAX_BUSINESS_LENGTH = LIMITS.businessName;
export const MAX_INTERESTS = 10;
export const MAX_INTEREST_LENGTH = 30;

/** Lines of work to pick from. "Other" isn't one: the member just leaves it blank. */
export const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Law',
  'Real estate',
  'Engineering',
  'Government',
  'Sales & marketing',
  'Media & arts',
  'Nonprofit',
  'Military',
  'Trades & construction',
  'Hospitality',
  'Business owner',
  'Student',
  'Retired',
] as const;

/** A head start on interests; members can add their own too. */
export const SUGGESTED_INTERESTS = [
  'Mentoring',
  'Community service',
  'Fitness',
  'Basketball',
  'Golf',
  'Travel',
  'Investing',
  'Entrepreneurship',
  'Tech',
  'Music',
  'Cooking',
  'Reading',
  'Faith',
  'Politics',
  'Photography',
  'Fraternity history',
] as const;

const tidy = (raw: string) => raw.trim().replace(/\s+/g, ' ');
const has = (list: string[], value: string) =>
  list.some((v) => v.toLowerCase() === value.toLowerCase());

/** Picks an industry, or clears it when tapped again. */
export const toggleIndustry = (current: string, picked: string) =>
  current === picked ? '' : picked;

/**
 * Adds an interest typed by the member. Returns the new list, or a message if it can't be
 * added (empty, too long, a repeat, or the list is full).
 */
export function addInterest(
  interests: string[],
  raw: string,
): { interests: string[] } | { error: string } {
  const value = tidy(raw);
  if (!value) return { error: 'Type an interest first.' };
  if (value.length > MAX_INTEREST_LENGTH) {
    return { error: `Keep each interest to ${MAX_INTEREST_LENGTH} characters.` };
  }
  if (has(interests, value)) return { error: 'You already added that.' };
  if (interests.length >= MAX_INTERESTS) return { error: `You can add up to ${MAX_INTERESTS}.` };
  return { interests: [...interests, value] };
}

/** Picks a suggested interest, or drops it if it's already picked. Stops at the limit. */
export function toggleInterest(interests: string[], value: string): string[] {
  if (has(interests, value))
    return interests.filter((i) => i.toLowerCase() !== value.toLowerCase());
  return interests.length >= MAX_INTERESTS ? interests : [...interests, value];
}

/** Adds a business he owns, like addInterest. */
export function addBusiness(
  businesses: string[],
  raw: string,
): { businesses: string[] } | { error: string } {
  const value = tidy(raw);
  if (!value) return { error: 'Type the business name first.' };
  if (value.length > MAX_BUSINESS_LENGTH) {
    return { error: `Keep the name to ${MAX_BUSINESS_LENGTH} characters.` };
  }
  if (has(businesses, value)) return { error: 'You already added that.' };
  if (businesses.length >= MAX_BUSINESSES) {
    return { error: `You can add up to ${MAX_BUSINESSES}.` };
  }
  return { businesses: [...businesses, value] };
}

/** "Works in Technology", or nothing if he didn't say. */
export const industryLine = (industry: string) =>
  industry.trim() ? `Works in ${industry.trim()}` : '';

/** "Owns Sample Realty and Sample Barbershop". */
export function businessLine(businesses: string[]): string {
  const names = businesses.map((b) => b.trim()).filter(Boolean);
  if (names.length === 0) return '';
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Owns ${list}`;
}
