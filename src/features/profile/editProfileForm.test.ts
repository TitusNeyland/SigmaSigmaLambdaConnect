import {
  addInterest,
  formFromProfile,
  isDirty,
  MAX_INTERESTS,
  normalizeForm,
  validateEditProfile,
  type EditProfileForm,
} from './editProfileForm';

const form = (overrides: Partial<EditProfileForm> = {}): EditProfileForm => ({
  displayName: 'Marcus Reed',
  initiationTerm: 'Spring 2019',
  headline: 'Software engineer',
  bio: 'Mentoring chair.',
  interests: ['Tech'],
  phone: '',
  showEmail: true,
  showPhone: false,
  ...overrides,
});

describe('formFromProfile', () => {
  it('copies the editable fields and leaves out email and photo', () => {
    expect(
      formFromProfile({
        ...form(),
        photoURL: 'https://cdn.test/a.jpg',
        email: 'm@example.com',
        notificationPrefs: { events: true, announcements: true, social: true, tasks: false },
      }),
    ).toEqual(form());
  });
});

describe('normalizeForm', () => {
  it('trims text and drops blank interests', () => {
    expect(
      normalizeForm(
        form({
          displayName: '  Marcus Reed ',
          headline: ' Engineer ',
          bio: ' Hi ',
          interests: [' Tech ', '  '],
          phone: ' 555 123 4567 ',
          showPhone: true,
        }),
      ),
    ).toEqual(
      form({
        headline: 'Engineer',
        bio: 'Hi',
        interests: ['Tech'],
        phone: '555 123 4567',
        showPhone: true,
      }),
    );
  });

  it('turns off Show phone when there is no phone', () => {
    expect(normalizeForm(form({ phone: '  ', showPhone: true })).showPhone).toBe(false);
  });
});

describe('validateEditProfile', () => {
  it('accepts a normal profile', () => {
    expect(validateEditProfile(form())).toEqual({});
  });

  it('requires a name and initiation term', () => {
    const errors = validateEditProfile(form({ displayName: ' ', initiationTerm: '' }));
    expect(errors.displayName).toBe('Enter your name.');
    expect(errors.initiationTerm).toMatch(/initiated/);
  });

  it('enforces the headline and bio limits from the rules', () => {
    expect(validateEditProfile(form({ headline: 'a'.repeat(80) })).headline).toBeUndefined();
    expect(validateEditProfile(form({ headline: 'a'.repeat(81) })).headline).toMatch(/80/);
    expect(validateEditProfile(form({ bio: 'a'.repeat(150) })).bio).toBeUndefined();
    expect(validateEditProfile(form({ bio: 'a'.repeat(151) })).bio).toMatch(/150/);
  });

  it.each(['(555) 123-4567', '+1 555 123 4567', '555.123.4567', ''])(
    'accepts the phone %p',
    (phone) => {
      expect(validateEditProfile(form({ phone })).phone).toBeUndefined();
    },
  );

  it.each(['call me', '12', 'abc-defg-hijk', '555-123-4567 ext 9', '+1 (555) 123-4567 0000 0000'])(
    'rejects the phone %p',
    (phone) => {
      expect(validateEditProfile(form({ phone })).phone).toMatch(/phone number/);
    },
  );

  it('rejects a phone over 30 characters', () => {
    expect(validateEditProfile(form({ phone: '1'.repeat(31) })).phone).toMatch(/30/);
  });
});

describe('addInterest', () => {
  it('adds a trimmed interest and collapses spaces', () => {
    expect(addInterest(['Tech'], '  Career   mentoring ')).toEqual({
      interests: ['Tech', 'Career mentoring'],
    });
  });

  it('rejects empty input', () => {
    expect(addInterest([], '   ')).toEqual({ error: 'Type an interest first.' });
  });

  it('rejects duplicates regardless of case', () => {
    expect(addInterest(['Tech'], 'tech')).toEqual({ error: 'You already added that.' });
  });

  it('rejects interests over 30 characters', () => {
    expect(addInterest([], 'a'.repeat(31))).toEqual({
      error: 'Keep each interest to 30 characters.',
    });
  });

  it('stops at the limit the rules allow', () => {
    const full = Array.from({ length: MAX_INTERESTS }, (_, i) => `Interest ${i}`);
    expect(addInterest(full, 'One more')).toEqual({ error: 'You can add up to 10.' });
  });
});

describe('isDirty', () => {
  it('ignores whitespace-only changes', () => {
    expect(isDirty(form(), form({ bio: ' Mentoring chair. ' }))).toBe(false);
  });

  it('notices real changes', () => {
    expect(isDirty(form(), form({ bio: 'New bio' }))).toBe(true);
    expect(isDirty(form(), form({ showEmail: false }))).toBe(true);
    expect(isDirty(form(), form({ interests: [] }))).toBe(true);
  });
});
