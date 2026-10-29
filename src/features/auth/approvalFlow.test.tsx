import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import { SUPPORT_EMAIL } from '@/config/app';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
jest.mock('@/data/roles');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

function signInAs(status: 'pending' | 'approved' | 'declined' | null) {
  auth.resetAuthMock();
  members.resetMembersMock(status === null ? null : members.sampleMember({ status }));
  auth.setMockUser(auth.sampleUser());
}

describe('pending members', () => {
  beforeEach(() => signInAs('pending'));

  it('wait on the approval screen with what they submitted', async () => {
    await renderRouter('src/app', { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/pending'));
    expect(screen.getByRole('header', { name: 'Waiting for approval' })).toBeTruthy();
    expect(screen.getByText('Marcus Reed')).toBeTruthy();
    expect(screen.getByText('Spring 2019')).toBeTruthy();
  });

  it('cannot reach the tabs or the post modal', async () => {
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() => expect(screen).not.toHavePathname('/home'));
    expect(screen.queryByTestId('tab-home')).toBeNull();
  });

  it('move into the app the moment an officer approves them', async () => {
    await renderRouter('src/app', { initialUrl: '/pending' });
    await waitFor(() => expect(screen).toHavePathname('/pending'));
    await act(async () => {
      members.setMockMember(members.sampleMember({ status: 'approved' }));
    });
    await waitFor(() => expect(screen.getByTestId('tab-home')).toBeTruthy());
  });

  it('see the declined screen if an officer says no', async () => {
    await renderRouter('src/app', { initialUrl: '/pending' });
    await act(async () => {
      members.setMockMember(members.sampleMember({ status: 'declined' }));
    });
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Request not approved' })).toBeTruthy(),
    );
  });

  it('can sign out', async () => {
    await renderRouter('src/app', { initialUrl: '/pending' });
    await press(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Sigma Sigma Lambda' })).toBeTruthy(),
    );
  });
});

describe('declined members', () => {
  beforeEach(() => signInAs('declined'));

  it('see a message and cannot reach chapter content', async () => {
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Request not approved' })).toBeTruthy(),
    );
    expect(screen.queryByTestId('tab-home')).toBeNull();
  });

  it('can email the chapter', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderRouter('src/app', { initialUrl: '/declined' });
    await press(screen.getByRole('button', { name: 'Contact the chapter' }));
    expect(open).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`);
    open.mockRestore();
  });
});

describe('approved members', () => {
  beforeEach(() => signInAs('approved'));

  it('go straight to the tabs', async () => {
    await renderRouter('src/app', { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/home'));
  });

  it('never see the pending screen', async () => {
    await renderRouter('src/app', { initialUrl: '/pending' });
    await waitFor(() => expect(screen).not.toHavePathname('/pending'));
  });

  it('are sent back to waiting if an officer changes their status', async () => {
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() => expect(screen.getByTestId('tab-home')).toBeTruthy());
    await act(async () => {
      members.setMockMember(members.sampleMember({ status: 'pending' }));
    });
    await waitFor(() => expect(screen.queryByTestId('tab-home')).toBeNull());
  });
});

describe('accounts without a profile', () => {
  beforeEach(() => signInAs(null));

  it('are asked to finish their profile', async () => {
    await renderRouter('src/app', { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/complete-profile'));
    expect(screen.getByRole('header', { name: 'Finish your profile' })).toBeTruthy();
  });

  it('must fill in both fields', async () => {
    await renderRouter('src/app', { initialUrl: '/complete-profile' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('profile-name'), '');
    });
    await press(screen.getByTestId('profile-submit'));
    expect(screen.getByText('Enter your name.')).toBeTruthy();
    expect(screen.getByText(/Enter when you were initiated/)).toBeTruthy();
    expect(members.createPendingProfile).not.toHaveBeenCalled();
  });

  it('prefill the name from the account and save a pending profile', async () => {
    await renderRouter('src/app', { initialUrl: '/complete-profile' });
    expect(screen.getByTestId('profile-name')).toHaveProp('value', 'Marcus Reed');
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('profile-term'), 'Spring 2019');
    });
    await press(screen.getByTestId('profile-submit'));
    expect(members.createPendingProfile).toHaveBeenCalledWith('sample-marcus', {
      displayName: 'Marcus Reed',
      initiationTerm: 'Spring 2019',
      email: 'sample-marcus@example.com',
    });
  });

  it('move to the pending screen once the profile exists', async () => {
    await renderRouter('src/app', { initialUrl: '/complete-profile' });
    await act(async () => {
      members.setMockMember(members.sampleMember({ status: 'pending' }));
    });
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Waiting for approval' })).toBeTruthy(),
    );
  });
});

describe('when the profile cannot load', () => {
  it('shows a retry screen instead of hanging, and retries', async () => {
    auth.resetAuthMock();
    members.resetMembersMock(undefined);
    members.subscribeToOwnMember.mockImplementationOnce((_uid, _onChange, onError) => {
      onError?.(new Error('offline'));
      return () => {};
    });
    auth.setMockUser(auth.sampleUser());
    await renderRouter('src/app', { initialUrl: '/' });
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Can’t reach the chapter' })).toBeTruthy(),
    );
    const calls = members.subscribeToOwnMember.mock.calls.length;
    members.setMockMember(members.sampleMember({ status: 'approved' }));
    await press(screen.getByTestId('session-retry'));
    expect(members.subscribeToOwnMember.mock.calls.length).toBeGreaterThan(calls);
    await waitFor(() => expect(screen.getByTestId('tab-home')).toBeTruthy());
  });
});
