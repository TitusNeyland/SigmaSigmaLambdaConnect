import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { RequireCapability, useCan, useRole } from './RoleProvider';

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
const roles = jest.requireMock<typeof import('@/data/__mocks__/roles')>('@/data/roles');

function signIn(status: 'approved' | 'pending', role: Parameters<typeof roles.resetRolesMock>[0]) {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status }));
  roles.resetRolesMock(role);
  auth.setMockUser(auth.sampleUser());
}

async function openChapter() {
  await renderRouter('src/app', { initialUrl: '/chapter' });
  await waitFor(() => expect(screen.getByRole('header', { name: 'Chapter' })).toBeTruthy());
}

describe('Chapter tab leadership entry', () => {
  it('is hidden from regular members', async () => {
    signIn('approved', null);
    await openChapter();
    expect(screen.queryByTestId('leadership-entry')).toBeNull();
  });

  it('shows for officers with their title', async () => {
    signIn('approved', { role: 'officer', title: 'Treasurer' });
    await openChapter();
    expect(screen.getByTestId('leadership-entry')).toBeTruthy();
    expect(screen.getByText('Signed in as Treasurer. Built in #46.')).toBeTruthy();
  });

  it('shows for admins', async () => {
    signIn('approved', { role: 'admin' });
    await openChapter();
    expect(screen.getByText('Signed in as Admin. Built in #46.')).toBeTruthy();
  });

  it('appears the moment an admin promotes someone, and disappears on demotion', async () => {
    signIn('approved', null);
    await openChapter();
    expect(screen.queryByTestId('leadership-entry')).toBeNull();

    await act(async () => roles.setMockRole({ role: 'officer', title: 'Secretary' }));
    await waitFor(() => expect(screen.getByTestId('leadership-entry')).toBeTruthy());

    await act(async () => roles.setMockRole(null));
    await waitFor(() => expect(screen.queryByTestId('leadership-entry')).toBeNull());
  });

  it('stays hidden if the role cannot load (fails closed)', async () => {
    signIn('approved', { role: 'officer' });
    roles.failNextRoleLoad();
    await openChapter();
    expect(screen.queryByTestId('leadership-entry')).toBeNull();
  });
});

describe('role loading', () => {
  it('does not look up a role for someone still pending', async () => {
    signIn('pending', { role: 'officer' });
    await renderRouter('src/app', { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/pending'));
    expect(roles.subscribeToRole).not.toHaveBeenCalled();
  });

  it('looks up the signed-in member’s own role once approved', async () => {
    signIn('approved', null);
    await openChapter();
    expect(roles.subscribeToRole).toHaveBeenCalledWith(
      auth.sampleUser().uid,
      expect.any(Function),
      expect.any(Function),
    );
  });
});

describe('hooks', () => {
  function Probe() {
    const role = useRole();
    const approve = useCan('members.approve');
    const manageRoles = useCan('roles.manage');
    return (
      <>
        <Text testID="level">{role.level}</Text>
        <Text testID="label">{role.label}</Text>
        <Text testID="approve">{String(approve)}</Text>
        <Text testID="manage-roles">{String(manageRoles)}</Text>
        <RequireCapability capability="roles.manage">
          <Text testID="admin-only">admin tools</Text>
        </RequireCapability>
      </>
    );
  }

  async function renderProbe() {
    await renderRouter(
      { 'probe/index': Probe, '(tabs)/_layout': () => null },
      { initialUrl: '/probe' },
    );
  }

  it('gives officers officer tools but not role management', async () => {
    signIn('approved', { role: 'officer', title: 'Vice President' });
    // Render the probe inside the real providers by reusing the app's root layout.
    await renderRouter(
      {
        _layout: jest.requireActual('../../app/_layout').default,
        'probe/index': Probe,
      },
      { initialUrl: '/probe' },
    );
    await waitFor(() => expect(screen.getByTestId('level')).toHaveTextContent('officer'));
    expect(screen.getByTestId('label')).toHaveTextContent('Vice President');
    expect(screen.getByTestId('approve')).toHaveTextContent('true');
    expect(screen.getByTestId('manage-roles')).toHaveTextContent('false');
    expect(screen.queryByTestId('admin-only')).toBeNull();
  });

  it('defaults to member with nothing allowed outside the providers', async () => {
    signIn('approved', { role: 'admin' });
    await renderProbe();
    expect(screen.getByTestId('level')).toHaveTextContent('member');
    expect(screen.getByTestId('approve')).toHaveTextContent('false');
    expect(screen.queryByTestId('admin-only')).toBeNull();
  });
});
