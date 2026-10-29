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
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');

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
  it('flags every missing field', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-up' });
    await press(screen.getByTestId('sign-up-submit'));
    expect(screen.getByText('Enter your name.')).toBeTruthy();
    expect(screen.getByText(/Enter when you were initiated/)).toBeTruthy();
    expect(screen.getByText('Enter your email.')).toBeTruthy();
    expect(screen.getByText('Enter a password.')).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('creates the account with the form values', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-up' });
    await type('sign-up-name', 'Marcus Reed');
    await type('sign-up-term', 'Spring 2019');
    await type('sign-up-email', 'sample-marcus@example.com');
    await type('sign-up-password', 'brother2019');
    await press(screen.getByTestId('sign-up-submit'));
    expect(auth.signUp).toHaveBeenCalledWith({
      displayName: 'Marcus Reed',
      initiationTerm: 'Spring 2019',
      email: 'sample-marcus@example.com',
      password: 'brother2019',
    });
  });

  it('explains when the email is taken', async () => {
    auth.signUp.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
    await renderRouter('src/app', { initialUrl: '/sign-up' });
    await type('sign-up-name', 'Marcus Reed');
    await type('sign-up-term', 'Spring 2019');
    await type('sign-up-email', 'sample-marcus@example.com');
    await type('sign-up-password', 'brother2019');
    await press(screen.getByTestId('sign-up-submit'));
    await waitFor(() =>
      expect(screen.getByText('An account already uses that email. Try signing in.')).toBeTruthy(),
    );
  });

  it('rejects a weak password before calling Firebase', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-up' });
    await type('sign-up-name', 'Marcus Reed');
    await type('sign-up-term', 'Spring 2019');
    await type('sign-up-email', 'sample-marcus@example.com');
    await type('sign-up-password', 'short');
    await press(screen.getByTestId('sign-up-submit'));
    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
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
