import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import { SUPPORT_EMAIL } from '@/config/app';

import { IN_APP_LINK, POLICIES_UPDATED } from './policies';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
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

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  auth.setMockUser(auth.sampleUser());
});

async function openPolicy(kind: 'privacy' | 'terms') {
  await renderRouter('src/app', { initialUrl: `/profile/${kind}` });
  await waitFor(() => expect(screen.getByTestId(`policy-${kind}`)).toBeTruthy());
  return screen.getByTestId(`policy-${kind}`);
}

it('shows the privacy policy as a page in the app, with the date and support email', async () => {
  const page = await openPolicy('privacy');
  expect(screen.getByRole('header', { name: 'Privacy policy' })).toBeTruthy();
  const html: string = page.props.source.html;
  expect(html).toContain('<h1>Privacy policy</h1>');
  expect(html).toContain(`Last updated ${POLICIES_UPDATED}`);
  expect(html).toContain(`mailto:${SUPPORT_EMAIL}`);
  expect(html).not.toMatch(/\{\{|\}\}/);
  // No site header in the app; the screen has its own back button.
  expect(html).not.toContain('<header>');
});

it('opens links to other pages in the app, and email in the mail app', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  const page = await openPolicy('terms');
  const html: string = page.props.source.html;
  expect(html).toContain(`href="${IN_APP_LINK}guidelines"`);
  const tap = (url: string) => page.props.onShouldStartLoadWithRequest({ url });

  expect(tap('about:blank')).toBe(true);
  let allowed = true;
  await act(async () => {
    allowed = tap(`mailto:${SUPPORT_EMAIL}`);
  });
  expect(allowed).toBe(false);
  expect(openURL).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`);

  await act(async () => {
    tap(`${IN_APP_LINK}privacy`);
  });
  await waitFor(() => expect(screen).toHavePathname('/profile/privacy'));
  openURL.mockRestore();
});
