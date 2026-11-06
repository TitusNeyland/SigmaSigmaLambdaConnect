import {
  addBusiness,
  addInterest,
  businessLine,
  industryLine,
  INDUSTRIES,
  MAX_BUSINESSES,
  MAX_INTERESTS,
  SUGGESTED_INTERESTS,
  toggleIndustry,
  toggleInterest,
} from './aboutYou';

it('offers lines of work and interests to pick from', () => {
  expect(INDUSTRIES).toContain('Real estate');
  expect(SUGGESTED_INTERESTS).toContain('Mentoring');
  // No repeats.
  expect(new Set(INDUSTRIES).size).toBe(INDUSTRIES.length);
  expect(new Set(SUGGESTED_INTERESTS).size).toBe(SUGGESTED_INTERESTS.length);
});

it('picks an industry, and tapping it again clears it', () => {
  expect(toggleIndustry('', 'Law')).toBe('Law');
  expect(toggleIndustry('Law', 'Finance')).toBe('Finance');
  expect(toggleIndustry('Law', 'Law')).toBe('');
});

it('toggles suggested interests, up to the limit', () => {
  expect(toggleInterest(['Golf'], 'Travel')).toEqual(['Golf', 'Travel']);
  expect(toggleInterest(['Golf', 'Travel'], 'golf')).toEqual(['Travel']);
  const full = Array.from({ length: MAX_INTERESTS }, (_, i) => `Interest ${i}`);
  expect(toggleInterest(full, 'Golf')).toBe(full);
});

it('adds typed interests, tidied, without repeats', () => {
  expect(addInterest([], '  Chess   club ')).toEqual({ interests: ['Chess club'] });
  expect(addInterest(['Chess'], 'chess')).toEqual({ error: 'You already added that.' });
  expect(addInterest([], ' ')).toEqual({ error: 'Type an interest first.' });
});

it('adds up to 3 businesses he owns', () => {
  expect(addBusiness([], ' Sample   Realty ')).toEqual({ businesses: ['Sample Realty'] });
  expect(addBusiness(['Sample Realty'], 'sample realty')).toEqual({
    error: 'You already added that.',
  });
  expect(addBusiness([], '')).toEqual({ error: 'Type the business name first.' });
  expect(addBusiness([], 'x'.repeat(61))).toEqual({ error: 'Keep the name to 60 characters.' });
  const full = Array.from({ length: MAX_BUSINESSES }, (_, i) => `Business ${i}`);
  expect(addBusiness(full, 'One more')).toEqual({ error: 'You can add up to 3.' });
});

it('says what he does and owns in a line for his profile', () => {
  expect(industryLine(' Real estate ')).toBe('Works in Real estate');
  expect(industryLine('')).toBe('');
  expect(businessLine(['Sample Realty'])).toBe('Owns Sample Realty');
  expect(businessLine(['Sample Realty', 'Sample Barbershop'])).toBe(
    'Owns Sample Realty and Sample Barbershop',
  );
  expect(businessLine(['A', 'B', 'C'])).toBe('Owns A, B and C');
  expect(businessLine([' '])).toBe('');
});
