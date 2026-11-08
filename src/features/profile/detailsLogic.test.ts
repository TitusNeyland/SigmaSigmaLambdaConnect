import { hasMoreDetails, phoneUrl } from './detailsLogic';

describe('hasMoreDetails', () => {
  const none = { businesses: [], interests: [], phone: '', showPhone: false };

  it('is false when there is nothing to fold away', () => {
    expect(hasMoreDetails(none)).toBe(false);
  });

  it('is true for businesses, interests or a phone he chose to show', () => {
    expect(hasMoreDetails({ ...none, businesses: ['Sample Studio'] })).toBe(true);
    expect(hasMoreDetails({ ...none, interests: ['Golf'] })).toBe(true);
    expect(hasMoreDetails({ ...none, phone: '555-010-0100', showPhone: true })).toBe(true);
  });

  it('ignores a phone he keeps private', () => {
    expect(hasMoreDetails({ ...none, phone: '555-010-0100', showPhone: false })).toBe(false);
  });
});

describe('phoneUrl', () => {
  it('keeps only the digits and a leading +', () => {
    expect(phoneUrl('(555) 010-0100')).toBe('tel:5550100100');
    expect(phoneUrl('+1 555 010 0100')).toBe('tel:+15550100100');
  });

  it('is null without enough digits', () => {
    expect(phoneUrl('ext 12')).toBeNull();
  });
});
