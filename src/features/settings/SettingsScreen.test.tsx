import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import { COMMUNITY_GUIDELINES_URL, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/config/app';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
const roles = jest.requireMock<typeof import('@/data/__mocks__/roles')>('@/data/roles');
jest.mock('@/data/profile');
const profile = jest.requireMock<typeof import('@/data/__mocks__/profile')>('@/data/profile');
jest.mock('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
jest.mock('@/data/eventAdmin');
jest.mock('@/data/feed');
jest.mock('@/data/likes');
const account = jest.requireMock<typeof import('@/data/__mocks__/account')>('@/data/account');
const blocks = jest.requireMock<typeof import('@/data/__mocks__/blocks')>('@/data/blocks');

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

async function flip(testID: string, value: boolean) {
  await act(async () => {
    fireEvent(screen.getByTestId(testID), 'valueChange', value);
  });
}

let openURL: jest.SpyInstance;

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock();
  roles.resetRolesMock(null);
  profile.resetProfileMock();
  blocks.resetBlocksMock();
  account.resetAccountMock();
  auth.setMockUser(auth.sampleUser());
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});

afterEach(() => openURL.mockRestore());

const uid = () => auth.sampleUser().uid;

async function openSettings() {
  await renderRouter('src/app', { initialUrl: '/profile' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy());
  await press(screen.getByRole('button', { name: 'Settings' }));
  await waitFor(() => expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy());
}

describe('Settings: account', () => {
  it('shows the account email and approved membership', async () => {
    await openSettings();
    expect(screen.getByText(auth.sampleUser().email!)).toBeTruthy();
    expect(screen.getByTestId('membership-chip')).toHaveTextContent('Approved');
  });

  it('sends a password reset link to the account email after confirming', async () => {
    await openSettings();
    await press(screen.getByTestId('row-password'));
    expect(auth.sendPasswordReset).not.toHaveBeenCalled();
    await press(screen.getByTestId('send-reset'));
    expect(auth.sendPasswordReset).toHaveBeenCalledWith(auth.sampleUser().email);
    await waitFor(() =>
      expect(
        screen.getByText(`Check ${auth.sampleUser().email} for a link to set a new password.`),
      ).toBeTruthy(),
    );
  });

  it('says so if the reset email fails', async () => {
    auth.sendPasswordReset.mockRejectedValueOnce(new Error('auth/too-many-requests'));
    await openSettings();
    await press(screen.getByTestId('row-password'));
    await press(screen.getByTestId('send-reset'));
    await waitFor(() =>
      expect(screen.getByText('Couldn’t send the email. Try again in a minute.')).toBeTruthy(),
    );
  });
});

describe('Settings: notifications', () => {
  it('shows each switch from the member’s saved preferences', async () => {
    profile.resetProfileMock(
      profile.sampleProfile({
        notificationPrefs: { events: false, announcements: true, social: true, tasks: true },
      }),
    );
    await openSettings();
    expect(screen.getByTestId('pref-events')).not.toBeChecked();
    expect(screen.getByTestId('pref-announcements')).toBeChecked();
    expect(screen.getByTestId('pref-tasks')).toBeChecked();
  });

  it('saves a change for this member', async () => {
    await openSettings();
    await flip('pref-social', false);
    expect(profile.setNotificationPref).toHaveBeenCalledWith(uid(), 'social', false);
  });

  it('rolls back and explains if a change can’t be saved', async () => {
    profile.setNotificationPref.mockRejectedValueOnce(new Error('unavailable'));
    await openSettings();
    await flip('pref-events', false);
    await waitFor(() =>
      expect(
        screen.getByText('Couldn’t save that change. Check your connection and try again.'),
      ).toBeTruthy(),
    );
    expect(screen.getByTestId('pref-events')).toBeChecked();
  });
});

describe('Settings: privacy and help', () => {
  it('shows how many accounts are blocked and opens the list', async () => {
    blocks.resetBlocksMock([{ uid: 'b', displayName: 'Brandon Lee', photoURL: null }]);
    await openSettings();
    expect(screen.getByTestId('row-blocked')).toHaveTextContent(/1/);
    await press(screen.getByTestId('row-blocked'));
    await waitFor(() => expect(screen).toHavePathname('/profile/blocked'));
    expect(screen.getByText('Brandon Lee')).toBeTruthy();
  });

  it('says profiles are visible to chapter members only', async () => {
    await openSettings();
    expect(screen.getByText('Chapter members')).toBeTruthy();
  });

  it.each([
    ['row-guidelines', COMMUNITY_GUIDELINES_URL],
    ['row-terms', TERMS_URL],
    ['row-privacy', PRIVACY_URL],
    ['row-support', `mailto:${SUPPORT_EMAIL}`],
  ])('%s opens %s', async (testID, url) => {
    await openSettings();
    await press(screen.getByTestId(testID));
    expect(openURL).toHaveBeenCalledWith(url);
  });

  it('shows the support contact, which the App Store requires', async () => {
    await openSettings();
    expect(screen.getByText(SUPPORT_EMAIL)).toBeTruthy();
  });
});

describe('Settings: sign out', () => {
  it('asks first, and Cancel keeps the member signed in', async () => {
    await openSettings();
    await press(screen.getByTestId('row-sign-out'));
    expect(screen.getByText('You’ll need to sign in again to see the chapter.')).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Cancel' }));
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('signs out and returns to the welcome screen after confirming', async () => {
    await openSettings();
    await press(screen.getByTestId('row-sign-out'));
    await press(screen.getByTestId('confirm-sign-out'));
    expect(auth.signOut).toHaveBeenCalled();
    await waitFor(() => expect(screen).toHavePathname('/welcome'));
  });
});

it('Back returns to the profile', async () => {
  await openSettings();
  await press(screen.getByTestId('settings-back'));
  await waitFor(() => expect(screen).toHavePathname('/profile'));
});

describe('Settings: delete account', () => {
  async function openDelete() {
    await openSettings();
    await press(screen.getByTestId('row-delete-account'));
    expect(screen.getByText(/This permanently removes your profile/)).toBeTruthy();
  }

  async function typePassword(text: string) {
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('delete-password'), text);
    });
  }

  it('explains what is removed and what is kept', async () => {
    await openDelete();
    expect(screen.getByText(/Attendance the chapter needs for its records is kept/)).toBeTruthy();
    expect(screen.getByText(/can’t be\s+undone/)).toBeTruthy();
  });

  it('needs the password before deleting', async () => {
    await openDelete();
    await press(screen.getByTestId('confirm-delete'));
    expect(screen.getByText('Enter your password to confirm.')).toBeTruthy();
    expect(account.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes the account and returns to Welcome', async () => {
    account.deleteAccount.mockImplementationOnce(async () => {
      auth.setMockUser(null);
    });
    await openDelete();
    await typePassword('secret123');
    await press(screen.getByTestId('confirm-delete'));
    expect(account.deleteAccount).toHaveBeenCalledWith('secret123');
    await waitFor(() => expect(screen).toHavePathname('/welcome'));
  });

  it.each([
    ['wrong-password', 'That password isn’t right.'],
    ['too-many-attempts', 'Too many tries. Wait a few minutes and try again.'],
    ['offline', 'You’re offline. Connect and try again.'],
    ['failed', 'Couldn’t delete your account. Try again, or contact the chapter.'],
  ] as const)('explains a %s error and stays signed in', async (reason, message) => {
    account.deleteAccount.mockRejectedValueOnce(new account.AccountDeletionError(reason));
    await openDelete();
    await typePassword('secret123');
    await press(screen.getByTestId('confirm-delete'));
    await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
    expect(screen).toHavePathname('/profile/settings');
  });

  it('Cancel closes without deleting', async () => {
    await openDelete();
    await typePassword('secret123');
    await press(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(account.deleteAccount).not.toHaveBeenCalled();
  });

  it('is reachable from Settings, as Apple requires', async () => {
    await openSettings();
    expect(screen.getByTestId('row-delete-account')).toHaveTextContent('Delete account');
  });
});
