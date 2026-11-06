import {
  EMPTY_DRAFT,
  FINISH_STEPS,
  OPTIONAL_STEPS,
  passwordChecks,
  SIGN_UP_STEPS,
  stepError,
  termOf,
  toSignUpInput,
  validateYear,
} from './signUpSteps';

const now = new Date(2026, 10, 6);

it('asks one thing at a time, in order, with About you in the middle', () => {
  expect(SIGN_UP_STEPS).toEqual([
    'name',
    'initiated',
    'work',
    'business',
    'interests',
    'photo',
    'email',
    'password',
    'review',
  ]);
  expect(OPTIONAL_STEPS).toEqual(['work', 'business', 'interests', 'photo']);
});

it('lets him skip About you, but keeps a job title to the profile limit', () => {
  for (const step of OPTIONAL_STEPS) expect(stepError(step, EMPTY_DRAFT, now)).toBe(undefined);
  expect(stepError('work', { ...EMPTY_DRAFT, headline: 'a'.repeat(81) }, now)).toBe(
    'Use 80 characters or fewer.',
  );
});

it('needs a name before moving on', () => {
  expect(stepError('name', EMPTY_DRAFT, now)).toBe('Enter your name.');
  expect(stepError('name', { ...EMPTY_DRAFT, displayName: ' Sample Brother ' }, now)).toBe(
    undefined,
  );
});

it('needs a season and a real year for when he crossed', () => {
  expect(stepError('initiated', { ...EMPTY_DRAFT, year: '2019' }, now)).toBe(
    'Pick the season you crossed.',
  );
  expect(stepError('initiated', { ...EMPTY_DRAFT, season: 'Spring', year: '19' }, now)).toBe(
    'Enter the year, like 2019.',
  );
  expect(stepError('initiated', { ...EMPTY_DRAFT, season: 'Fall', year: '2019' }, now)).toBe(
    undefined,
  );
});

it('keeps the year between the founding and this year', () => {
  expect(validateYear('1905', now)).toBe('Enter a year from 1906 to 2026.');
  expect(validateYear('2027', now)).toBe('Enter a year from 1906 to 2026.');
  expect(validateYear('1906', now)).toBe(undefined);
  expect(validateYear(' 2026 ', now)).toBe(undefined);
});

it('checks the email and password the same way sign in does', () => {
  expect(stepError('email', { ...EMPTY_DRAFT, email: 'nope' }, now)).toBe('Enter a valid email.');
  expect(stepError('password', { ...EMPTY_DRAFT, password: 'short' }, now)).toBe(
    'Use at least 8 characters.',
  );
  expect(stepError('password', { ...EMPTY_DRAFT, password: 'brother2019' }, now)).toBe(undefined);
});

it('turns the picks into the account to create', () => {
  expect(termOf('Spring', ' 2019 ')).toBe('Spring 2019');
  expect(termOf(null, '2019')).toBe('');
  const answers = {
    ...EMPTY_DRAFT,
    displayName: ' Sample Brother ',
    season: 'Spring' as const,
    year: '2019',
    email: 'sample@example.com',
    password: 'brother2019',
  };
  // Skipped About you: nothing extra.
  expect(toSignUpInput(answers)).toEqual({
    displayName: 'Sample Brother',
    initiationTerm: 'Spring 2019',
    email: 'sample@example.com',
    password: 'brother2019',
  });
  expect(
    toSignUpInput({
      ...answers,
      headline: ' Realtor ',
      industry: 'Real estate',
      businesses: ['Sample Realty'],
      interests: ['Golf'],
    }).about,
  ).toEqual({
    headline: 'Realtor',
    industry: 'Real estate',
    businesses: ['Sample Realty'],
    interests: ['Golf'],
  });
});

it('the review step catches anything still missing before the account is made', () => {
  const done = {
    ...EMPTY_DRAFT,
    displayName: 'Sample Brother',
    season: 'Fall' as const,
    year: '2015',
    email: 'sample@example.com',
    password: 'brother2019',
  };
  expect(stepError('review', done, now)).toBe(undefined);
  expect(stepError('review', { ...done, email: '' }, now)).toBe('Enter your email.');
});

it('finishing a profile asks the same questions, minus email and password', () => {
  expect(FINISH_STEPS).toEqual([
    'name',
    'initiated',
    'work',
    'business',
    'interests',
    'photo',
    'review',
  ]);
  const answers = {
    ...EMPTY_DRAFT,
    displayName: 'Sample Brother',
    season: 'Fall' as const,
    year: '2015',
  };
  // The account already has an email and password, so the review doesn't ask for them.
  expect(stepError('review', answers, now, FINISH_STEPS)).toBe(undefined);
  expect(stepError('review', answers, now)).toBe('Enter your email.');
});

it('sends the picked photo along to be uploaded', () => {
  const done = {
    ...EMPTY_DRAFT,
    displayName: 'Sample Brother',
    season: 'Fall' as const,
    year: '2015',
    email: 'sample@example.com',
    password: 'brother2019',
  };
  expect(toSignUpInput(done).photoUri).toBeUndefined();
  expect(toSignUpInput({ ...done, photoUri: 'file:///me.jpg' }).photoUri).toBe('file:///me.jpg');
});

it('ticks off each password rule as it’s met', () => {
  expect(passwordChecks('').map((c) => c.met)).toEqual([false, false, false]);
  expect(passwordChecks('abc1').map((c) => c.met)).toEqual([false, true, true]);
  expect(passwordChecks('brother2019').every((c) => c.met)).toBe(true);
});
