import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
jest.mock('@/data/roles');
jest.mock('@/data/profile');
jest.mock('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
jest.mock('@/data/eventAdmin');
jest.mock('@/data/feed');
jest.mock('@/data/likes');
jest.mock('@/data/posts');
jest.mock('@/data/comments');
jest.mock('@/data/programs');
jest.mock('@/data/announcements');
jest.mock('@/data/leadership');
jest.mock('@/data/requests');
jest.mock('@/data/attendance');
jest.mock('@/data/moderation');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/features/profile/pickAvatar', () => ({ pickAvatar: jest.fn(), AVATAR_SIZE: 512 }));
const { pickAvatar } = jest.requireMock<typeof import('@/features/profile/pickAvatar')>(
  '@/features/profile/pickAvatar',
);

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock();
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

async function type(testID: string, text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(testID), text);
  });
}

describe('signed out', () => {
  it('opens on the welcome screen', async () => {
    await renderRouter('src/app', { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/welcome'));
    expect(screen.getByRole('header', { name: 'Sigma Sigma Lambda' })).toBeTruthy();
  });

  it('cannot reach the tabs', async () => {
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() => expect(screen).not.toHavePathname('/home'));
    expect(screen.queryByTestId('tab-home')).toBeNull();
  });

  it('welcome buttons go to sign up and sign in', async () => {
    await renderRouter('src/app', { initialUrl: '/welcome' });
    await press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen).toHavePathname('/sign-up'));
  });
});

describe('sign in', () => {
  it('shows inline errors and does not call Firebase when the form is empty', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-in' });
    await press(screen.getByTestId('sign-in-submit'));
    expect(screen.getByText('Enter your email.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('signs in with what was typed', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-in' });
    await type('sign-in-email', 'sample-marcus@example.com');
    await type('sign-in-password', 'sample-password');
    await press(screen.getByTestId('sign-in-submit'));
    expect(auth.signIn).toHaveBeenCalledWith('sample-marcus@example.com', 'sample-password');
  });

  it('shows a plain message when sign in fails', async () => {
    auth.signIn.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    await renderRouter('src/app', { initialUrl: '/sign-in' });
    await type('sign-in-email', 'sample-marcus@example.com');
    await type('sign-in-password', 'wrong');
    await press(screen.getByTestId('sign-in-submit'));
    await waitFor(() =>
      expect(screen.getByText('That email and password don’t match.')).toBeTruthy(),
    );
  });

  it('goes to the tabs once signed in', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-in' });
    await act(async () => {
      auth.setMockUser(auth.sampleUser());
    });
    await waitFor(() => expect(screen.getByTestId('tab-home')).toBeTruthy());
  });

  it('links to creating an account', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-in' });
    await press(screen.getByText('Create an account'));
    await waitFor(() => expect(screen).toHavePathname('/sign-up'));
  });
});

describe('sign up', () => {
  /** Answers each step and taps Continue, ending on the password step. */
  async function fillUpToPassword() {
    await renderRouter('src/app', { initialUrl: '/sign-up' });
    await type('sign-up-name', 'Marcus Reed');
    await press(screen.getByTestId('sign-up-next'));
    await press(screen.getByTestId('sign-up-season-Spring'));
    await type('sign-up-year', '2019');
    await press(screen.getByTestId('sign-up-next'));
    // About you: skip work, add a business, continue past interests.
    await press(screen.getByTestId('sign-up-skip'));
    await type('business-input', 'Sample Realty');
    await press(screen.getByTestId('sign-up-next'));
    await press(screen.getByTestId('sign-up-skip'));
    // Photo: Skip for now.
    expect(screen.getByTestId('sign-up-next')).toHaveTextContent('Skip for now');
    await press(screen.getByTestId('sign-up-next'));
    await type('sign-up-email', 'sample-marcus@example.com');
    await press(screen.getByTestId('sign-up-next'));
    await waitFor(() => expect(screen.getByTestId('sign-up-password')).toBeTruthy());
  }

  /** From the password step: Continue to the review, then Create account. */
  async function createFromPassword() {
    await press(screen.getByTestId('sign-up-next'));
    await waitFor(() => expect(screen.getByTestId('sign-up-summary')).toBeTruthy());
    await press(screen.getByTestId('sign-up-submit'));
  }

  it('asks one thing at a time, with progress along the top', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-up' });
    expect(screen.getByRole('header', { name: 'What’s your name?' })).toBeTruthy();
    expect(screen.getByTestId('sign-up-progress').props.accessibilityLabel).toBe('Step 1 of 9');
    expect(screen.queryByTestId('sign-up-email')).toBeNull();
    await type('sign-up-name', 'Marcus Reed');
    await press(screen.getByTestId('sign-up-next'));
    expect(screen.getByRole('header', { name: 'When did you cross?' })).toBeTruthy();
    expect(screen.getByTestId('sign-up-progress').props.accessibilityLabel).toBe('Step 2 of 9');
  });

  it('won’t move on until the step is answered', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-up' });
    await press(screen.getByTestId('sign-up-next'));
    expect(screen.getByText('Enter your name.')).toBeTruthy();
    await type('sign-up-name', 'Marcus Reed');
    expect(screen.queryByText('Enter your name.')).toBeNull();
    await press(screen.getByTestId('sign-up-next'));
    await type('sign-up-year', '2019');
    await press(screen.getByTestId('sign-up-next'));
    expect(screen.getByText('Pick the season you crossed.')).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('Back steps back through the questions, keeping the answers', async () => {
    await fillUpToPassword();
    await press(screen.getByTestId('sign-up-back'));
    expect(screen.getByTestId('sign-up-email').props.value).toBe('sample-marcus@example.com');
    // Back past photo and interests to the business.
    await press(screen.getByTestId('sign-up-back'));
    await press(screen.getByTestId('sign-up-back'));
    await press(screen.getByTestId('sign-up-back'));
    expect(screen.getByTestId('business-list')).toHaveTextContent(/Sample Realty/);
    await press(screen.getByTestId('sign-up-back'));
    await press(screen.getByTestId('sign-up-back'));
    expect(screen.getByTestId('sign-up-year').props.value).toBe('2019');
  });

  it('creates the account with the answers', async () => {
    await fillUpToPassword();
    await type('sign-up-password', 'brother2019');
    await createFromPassword();
    expect(auth.signUp).toHaveBeenCalledWith({
      displayName: 'Marcus Reed',
      initiationTerm: 'Spring 2019',
      email: 'sample-marcus@example.com',
      password: 'brother2019',
      // The business typed on its step was added on Continue.
      about: { headline: '', industry: '', businesses: ['Sample Realty'], interests: [] },
    });
  });

  it('asks about work, businesses and interests, and saves them with the account', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-up' });
    await type('sign-up-name', 'Marcus Reed');
    await press(screen.getByTestId('sign-up-next'));
    await press(screen.getByTestId('sign-up-season-Fall'));
    await type('sign-up-year', '2015');
    await press(screen.getByTestId('sign-up-next'));

    expect(screen.getByRole('header', { name: 'What do you do?' })).toBeTruthy();
    await press(screen.getByTestId('industry-real-estate'));
    expect(screen.getByTestId('industry-real-estate').props.accessibilityState).toMatchObject({
      selected: true,
    });
    await type('sign-up-headline', 'Broker');
    await press(screen.getByTestId('sign-up-next'));

    expect(screen.getByRole('header', { name: 'Own a business?' })).toBeTruthy();
    await type('business-input', 'Sample Realty');
    await press(screen.getByTestId('business-add'));
    await type('business-input', 'Sample Barbershop');
    await press(screen.getByTestId('business-add'));
    await press(screen.getByTestId('business-remove-2'));
    await press(screen.getByTestId('sign-up-next'));

    expect(screen.getByRole('header', { name: 'What are you into?' })).toBeTruthy();
    await press(screen.getByTestId('interest-golf'));
    await type('interest-input', 'Chess');
    await press(screen.getByTestId('interest-add'));
    await press(screen.getByTestId('sign-up-next'));

    // Photo: pick one, and it shows.
    expect(screen.getByRole('header', { name: 'Add a profile photo' })).toBeTruthy();
    jest.mocked(pickAvatar).mockResolvedValueOnce({ status: 'picked', uri: 'file:///me.jpg' });
    await press(screen.getByTestId('sign-up-choose-photo'));
    await waitFor(() => expect(screen.getByTestId('sign-up-next')).toHaveTextContent('Continue'));
    await press(screen.getByTestId('sign-up-next'));

    await type('sign-up-email', 'sample-marcus@example.com');
    await press(screen.getByTestId('sign-up-next'));
    await type('sign-up-password', 'brother2019');
    await press(screen.getByTestId('sign-up-next'));

    // Review: everything he entered, then Create account.
    expect(screen.getByRole('header', { name: 'Review your information' })).toBeTruthy();
    expect(screen.getByTestId('summary-work')).toHaveTextContent(/Broker · Real estate/);
    expect(screen.getByTestId('summary-business')).toHaveTextContent(/Sample Realty/);
    expect(screen.getByTestId('summary-interests')).toHaveTextContent(/Golf, Chess/);
    expect(screen.getByTestId('summary-email')).toHaveTextContent(/sample-marcus@example.com/);
    await press(screen.getByTestId('sign-up-submit'));
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        initiationTerm: 'Fall 2015',
        about: {
          headline: 'Broker',
          industry: 'Real estate',
          businesses: ['Sample Realty'],
          interests: ['Golf', 'Chess'],
        },
        photoUri: 'file:///me.jpg',
      }),
    );
  });

  it('changing an answer from the review goes back to the review', async () => {
    await fillUpToPassword();
    await type('sign-up-password', 'brother2019');
    await press(screen.getByTestId('sign-up-next'));
    await press(screen.getByTestId('summary-work'));
    expect(screen.getByRole('header', { name: 'What do you do?' })).toBeTruthy();
    expect(screen.getByTestId('sign-up-next')).toHaveTextContent('Done');
    await press(screen.getByTestId('industry-law'));
    await press(screen.getByTestId('sign-up-next'));
    expect(screen.getByRole('header', { name: 'Review your information' })).toBeTruthy();
    expect(screen.getByTestId('summary-work')).toHaveTextContent(/Law/);
  });

  it('explains how to allow photos when access is off, and still lets him skip', async () => {
    await fillUpToPassword();
    // Back to the photo step.
    await press(screen.getByTestId('sign-up-back'));
    await press(screen.getByTestId('sign-up-back'));
    jest.mocked(pickAvatar).mockResolvedValueOnce({ status: 'denied' });
    await press(screen.getByTestId('sign-up-choose-photo'));
    await waitFor(() => expect(screen.getByTestId('sign-up-photo-note')).toBeTruthy());
    expect(screen.getByTestId('sign-up-next')).toHaveTextContent('Skip for now');
  });

  it('ticks off the password rules as you type', async () => {
    await fillUpToPassword();
    expect(screen.getByLabelText('A number, not yet')).toBeTruthy();
    await type('sign-up-password', 'abc1');
    expect(screen.getByLabelText('A number, done')).toBeTruthy();
    expect(screen.getByLabelText('At least 8 characters, not yet')).toBeTruthy();
  });

  it('explains when the email is taken', async () => {
    auth.signUp.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
    await fillUpToPassword();
    await type('sign-up-password', 'brother2019');
    await createFromPassword();
    await waitFor(() =>
      expect(screen.getByText('An account already uses that email. Try signing in.')).toBeTruthy(),
    );
  });

  it('rejects a weak password before calling Firebase', async () => {
    await fillUpToPassword();
    await type('sign-up-password', 'short');
    await press(screen.getByTestId('sign-up-next'));
    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe('welcome', () => {
  it('swipes through what the app is for, and Skip jumps to the end', async () => {
    await renderRouter('src/app', { initialUrl: '/welcome' });
    for (const title of [
      'Sigma Sigma Lambda',
      'Share the moments',
      'Show up for the chapter',
      'Just for brothers',
    ]) {
      expect(screen.getByRole('header', { name: title })).toBeTruthy();
    }
    expect(screen.getByTestId('intro-dot-1').props.accessibilityState).toMatchObject({
      selected: true,
    });
    await press(screen.getByTestId('intro-skip'));
    expect(screen.getByTestId('intro-dot-4').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.queryByTestId('intro-skip')).toBeNull();
  });
});

describe('signed in', () => {
  it('skips the welcome screen', async () => {
    auth.setMockUser(auth.sampleUser());
    await renderRouter('src/app', { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/home'));
  });

  it('cannot go back to the sign in screen', async () => {
    auth.setMockUser(auth.sampleUser());
    await renderRouter('src/app', { initialUrl: '/sign-in' });
    await waitFor(() => expect(screen).not.toHavePathname('/sign-in'));
  });

  it('returns to the welcome screen after signing out', async () => {
    auth.setMockUser(auth.sampleUser());
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() => expect(screen.getByTestId('tab-home')).toBeTruthy());
    await act(async () => {
      await auth.signOut();
    });
    await waitFor(() => expect(screen.queryByTestId('tab-home')).toBeNull());
  });
});
