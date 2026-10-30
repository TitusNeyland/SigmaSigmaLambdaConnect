import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
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
jest.mock('@/data/posts');
jest.mock('@/data/comments');
jest.mock('@/data/programs');

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  profile.resetProfileMock(profile.sampleProfile({ guidelinesAccepted: false }));
  auth.setMockUser(auth.sampleUser());
});

async function openPost() {
  await renderRouter('src/app', { initialUrl: '/new-post' });
  await waitFor(() => expect(screen.getByTestId('guidelines')).toBeTruthy());
}

it('shows the guidelines before a member’s first post, instead of the picker', async () => {
  await openPost();
  expect(screen.getByRole('header', { name: 'Before you post' })).toBeTruthy();
  expect(screen.getByText('1. Represent the chapter well')).toBeTruthy();
  expect(screen.getByText('6. Report, don’t argue')).toBeTruthy();
  expect(screen.queryByTestId('post-choose')).toBeNull();
});

it('agreeing records it and opens the picker', async () => {
  await openPost();
  await press(screen.getByTestId('guidelines-agree'));
  expect(profile.acceptGuidelines).toHaveBeenCalledWith(auth.sampleUser().uid);
  await waitFor(() => expect(screen.getByTestId('post-choose')).toBeTruthy());
});

it('stays on the guidelines and says so if saving fails', async () => {
  profile.acceptGuidelines.mockRejectedValueOnce(new Error('offline'));
  await openPost();
  await press(screen.getByTestId('guidelines-agree'));
  await waitFor(() =>
    expect(
      screen.getByText('Couldn’t save that. Check your connection and try again.'),
    ).toBeTruthy(),
  );
  expect(screen.queryByTestId('post-choose')).toBeNull();
});

it('cancel closes without agreeing', async () => {
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('tab-post')).toBeTruthy());
  await press(screen.getByTestId('tab-post'));
  await waitFor(() => expect(screen.getByTestId('guidelines-cancel')).toBeTruthy());
  await press(screen.getByTestId('guidelines-cancel'));
  await waitFor(() => expect(screen).toHavePathname('/home'));
  expect(profile.acceptGuidelines).not.toHaveBeenCalled();
});

it('goes straight to the picker for members who already agreed', async () => {
  profile.resetProfileMock(profile.sampleProfile({ guidelinesAccepted: true }));
  await renderRouter('src/app', { initialUrl: '/new-post' });
  await waitFor(() => expect(screen.getByTestId('post-choose')).toBeTruthy());
  expect(screen.queryByTestId('guidelines')).toBeNull();
});
