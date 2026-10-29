import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
jest.mock('@/data/roles');
jest.mock('@/data/profile');
jest.mock('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');

const unverified = () => auth.sampleUser({ emailVerified: false });

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock();
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

describe('email verification gate', () => {
  it('sends unverified users to the verify screen', async () => {
    auth.setMockUser(unverified());
    await renderRouter('src/app', { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/verify-email'));
    expect(screen.getByRole('header', { name: 'Check your email' })).toBeTruthy();
    expect(screen.getByText('sample-marcus@example.com')).toBeTruthy();
  });

  it('keeps unverified users out of the tabs', async () => {
    auth.setMockUser(unverified());
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() => expect(screen).not.toHavePathname('/home'));
    expect(screen.queryByTestId('tab-home')).toBeNull();
  });

  it('moves on to the tabs once the email is verified', async () => {
    auth.setMockUser(unverified());
    await renderRouter('src/app', { initialUrl: '/verify-email' });
    auth.setMockUserQuietly(auth.sampleUser({ emailVerified: true }));
    await press(screen.getByTestId('verify-check'));
    expect(auth.refreshUser).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('tab-home')).toBeTruthy());
  });

  it('says so when the email still is not verified', async () => {
    auth.setMockUser(unverified());
    await renderRouter('src/app', { initialUrl: '/verify-email' });
    await press(screen.getByTestId('verify-check'));
    await waitFor(() => expect(screen.getByText(/Not verified yet/)).toBeTruthy());
    expect(screen).toHavePathname('/verify-email');
  });

  it('resends the email and starts a cooldown that counts down', async () => {
    auth.setMockUser(unverified());
    await renderRouter('src/app', { initialUrl: '/verify-email' });
    await press(screen.getByTestId('verify-resend'));
    expect(auth.resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Sent. Check your inbox and spam folder.')).toBeTruthy();
    expect(screen.getByTestId('verify-resend')).toBeDisabled();
    expect(screen.getByText('Resend in 60s')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Resend in 59s')).toBeTruthy(), {
      timeout: 2500,
    });
    await press(screen.getByTestId('verify-resend'));
    expect(auth.resendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('explains a failed resend', async () => {
    auth.resendVerificationEmail.mockRejectedValueOnce({ code: 'auth/too-many-requests' });
    auth.setMockUser(unverified());
    await renderRouter('src/app', { initialUrl: '/verify-email' });
    await press(screen.getByTestId('verify-resend'));
    await waitFor(() => expect(screen.getByText(/Too many tries/)).toBeTruthy());
    expect(screen.getByTestId('verify-resend')).not.toBeDisabled();
  });

  it('can switch to a different account', async () => {
    auth.setMockUser(unverified());
    await renderRouter('src/app', { initialUrl: '/verify-email' });
    await press(screen.getByRole('button', { name: 'Use a different account' }));
    expect(auth.signOut).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Sigma Sigma Lambda' })).toBeTruthy(),
    );
  });

  it('verified users never see the verify screen', async () => {
    auth.setMockUser(auth.sampleUser());
    await renderRouter('src/app', { initialUrl: '/verify-email' });
    await waitFor(() => expect(screen).not.toHavePathname('/verify-email'));
  });
});

describe('forgot password', () => {
  it('is linked from sign in and keeps the typed email', async () => {
    await renderRouter('src/app', { initialUrl: '/sign-in' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('sign-in-email'), 'sample-marcus@example.com');
    });
    await press(screen.getByText('Forgot password?'));
    await waitFor(() => expect(screen).toHavePathname('/forgot-password'));
    expect(screen.getByTestId('reset-email')).toHaveProp('value', 'sample-marcus@example.com');
  });

  it('checks the email before sending', async () => {
    await renderRouter('src/app', { initialUrl: '/forgot-password' });
    await press(screen.getByTestId('reset-submit'));
    expect(screen.getByText('Enter your email.')).toBeTruthy();
    expect(auth.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('sends the reset email and confirms without saying whether the account exists', async () => {
    await renderRouter('src/app', { initialUrl: '/forgot-password' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('reset-email'), ' Marcus@Example.com ');
    });
    await press(screen.getByTestId('reset-submit'));
    expect(auth.sendPasswordReset).toHaveBeenCalledWith(' Marcus@Example.com ');
    await waitFor(() =>
      expect(screen.getByText(/If an account uses marcus@example.com/)).toBeTruthy(),
    );
  });

  it('explains a failure like a lost connection', async () => {
    auth.sendPasswordReset.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    await renderRouter('src/app', { initialUrl: '/forgot-password' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('reset-email'), 'a@example.com');
    });
    await press(screen.getByTestId('reset-submit'));
    await waitFor(() => expect(screen.getByText(/No connection/)).toBeTruthy());
  });

  it('can send again from the confirmation', async () => {
    await renderRouter('src/app', { initialUrl: '/forgot-password' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('reset-email'), 'a@example.com');
    });
    await press(screen.getByTestId('reset-submit'));
    await waitFor(() => expect(screen.getByText('Send again')).toBeTruthy());
    await press(screen.getByText('Send again'));
    expect(screen.getByTestId('reset-submit')).toBeTruthy();
  });
});
