import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
const roles = jest.requireMock<typeof import('@/data/__mocks__/roles')>('@/data/roles');
jest.mock('@/data/profile');
jest.mock('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
jest.mock('@/data/eventAdmin');
const profile = jest.requireMock<typeof import('@/data/__mocks__/profile')>('@/data/profile');
jest.mock('./pickAvatar', () => ({ pickAvatar: jest.fn(), AVATAR_SIZE: 512 }));
const { pickAvatar } = jest.requireMock<typeof import('./pickAvatar')>('./pickAvatar');

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

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock();
  roles.resetRolesMock(null);
  profile.resetProfileMock();
  jest.mocked(pickAvatar).mockReset();
  auth.setMockUser(auth.sampleUser());
});

const uid = () => auth.sampleUser().uid;

/** Opens Edit profile from the Profile tab, so Cancel and Done have somewhere to go back to. */
async function openEdit() {
  await renderRouter('src/app', { initialUrl: '/profile' });
  await waitFor(() => expect(screen.getByTestId('edit-profile')).toBeTruthy());
  await press(screen.getByTestId('edit-profile'));
  await waitFor(() => expect(screen.getByRole('header', { name: 'Edit profile' })).toBeTruthy());
}

describe('Edit profile', () => {
  it('starts with the current profile filled in', async () => {
    await openEdit();
    expect(screen.getByTestId('edit-name').props.value).toBe('Marcus Reed');
    expect(screen.getByTestId('edit-headline').props.value).toBe('Software engineer');
    expect(screen.getByTestId('edit-bio').props.value).toBe(
      'Mentoring chair. Happy to review a resume.',
    );
    expect(screen.getByTestId('edit-term').props.value).toBe('Spring 2019');
    expect(screen.getByText('Tech  ×')).toBeTruthy();
  });

  it('keeps Done disabled until something changes', async () => {
    await openEdit();
    expect(screen.getByTestId('edit-done')).toBeDisabled();
    await type('edit-headline', 'Staff engineer');
    expect(screen.getByTestId('edit-done')).toBeEnabled();
  });

  it('counts bio characters and stops at 150', async () => {
    await openEdit();
    await type('edit-bio', 'Short bio');
    expect(screen.getByTestId('bio-count')).toHaveTextContent('9/150');
    expect(screen.getByTestId('edit-bio').props.maxLength).toBe(150);
  });

  it('saves trimmed changes and returns to the profile', async () => {
    await openEdit();
    await type('edit-headline', '  Staff engineer ');
    await press(screen.getByTestId('edit-done'));
    await waitFor(() => expect(screen).toHavePathname('/profile'));
    expect(profile.updateOwnProfile).toHaveBeenCalledWith(
      uid(),
      {
        displayName: 'Marcus Reed',
        initiationTerm: 'Spring 2019',
        headline: 'Staff engineer',
        bio: 'Mentoring chair. Happy to review a resume.',
        interests: ['Tech', 'Career mentoring'],
        phone: '',
        showEmail: true,
        showPhone: false,
      },
      { email: 'marcus@example.com' },
    );
  });

  it('shows field errors and does not save an empty name', async () => {
    await openEdit();
    await type('edit-name', '   ');
    await press(screen.getByTestId('edit-done'));
    expect(screen.getByText('Enter your name.')).toBeTruthy();
    expect(profile.updateOwnProfile).not.toHaveBeenCalled();
  });

  it('keeps the form and shows a message if saving fails', async () => {
    profile.updateOwnProfile.mockRejectedValueOnce(new Error('unavailable'));
    await openEdit();
    await type('edit-bio', 'New bio');
    await press(screen.getByTestId('edit-done'));
    await waitFor(() =>
      expect(
        screen.getByText('Couldn’t save your profile. Check your connection and try again.'),
      ).toBeTruthy(),
    );
    expect(screen.getByTestId('edit-bio').props.value).toBe('New bio');
  });

  it('Cancel leaves without saving', async () => {
    await openEdit();
    await type('edit-bio', 'Unsaved');
    await press(screen.getByTestId('edit-cancel'));
    await waitFor(() => expect(screen).toHavePathname('/profile'));
    expect(profile.updateOwnProfile).not.toHaveBeenCalled();
  });

  it('shows the chapter role read-only', async () => {
    roles.resetRolesMock({ role: 'officer', title: 'Mentoring Chair' });
    await openEdit();
    await waitFor(() => expect(screen.getByText('Mentoring Chair')).toBeTruthy());
    expect(screen.queryByDisplayValue('Mentoring Chair')).toBeNull();
    expect(screen.getByText(/Roles are set by officers/)).toBeTruthy();
  });

  describe('interests', () => {
    it('adds and removes interests', async () => {
      await openEdit();
      await type('interest-input', 'Basketball');
      await press(screen.getByTestId('interest-add'));
      expect(screen.getByText('Basketball  ×')).toBeTruthy();
      expect(screen.getByTestId('interest-input').props.value).toBe('');
      await press(screen.getByRole('button', { name: 'Remove Tech' }));
      expect(screen.queryByText('Tech  ×')).toBeNull();
      await press(screen.getByTestId('edit-done'));
      await waitFor(() => expect(profile.updateOwnProfile).toHaveBeenCalled());
      expect(jest.mocked(profile.updateOwnProfile).mock.calls[0][1]).toMatchObject({
        interests: ['Career mentoring', 'Basketball'],
      });
    });

    it('explains why a duplicate can’t be added', async () => {
      await openEdit();
      await type('interest-input', 'tech');
      await press(screen.getByTestId('interest-add'));
      expect(screen.getByText('You already added that.')).toBeTruthy();
    });
  });

  describe('contact info', () => {
    it('shows the account email next to Show email', async () => {
      await openEdit();
      expect(screen.getByText('marcus@example.com')).toBeTruthy();
    });

    it('only allows Show phone once a phone is entered', async () => {
      await openEdit();
      expect(screen.getByTestId('switch-phone')).toBeDisabled();
      await type('edit-phone', '(555) 123-4567');
      expect(screen.getByTestId('switch-phone')).toBeEnabled();
      await act(async () => {
        fireEvent(screen.getByTestId('switch-phone'), 'valueChange', true);
      });
      await press(screen.getByTestId('edit-done'));
      await waitFor(() => expect(profile.updateOwnProfile).toHaveBeenCalled());
      expect(jest.mocked(profile.updateOwnProfile).mock.calls[0][1]).toMatchObject({
        phone: '(555) 123-4567',
        showPhone: true,
      });
    });

    it('rejects a phone that isn’t a number', async () => {
      await openEdit();
      await type('edit-phone', 'call me');
      await press(screen.getByTestId('edit-done'));
      expect(screen.getByText('Enter a phone number, like (555) 123-4567.')).toBeTruthy();
      expect(profile.updateOwnProfile).not.toHaveBeenCalled();
    });

    it('turns Show email off', async () => {
      await openEdit();
      await act(async () => {
        fireEvent(screen.getByTestId('switch-email'), 'valueChange', false);
      });
      await press(screen.getByTestId('edit-done'));
      await waitFor(() => expect(profile.updateOwnProfile).toHaveBeenCalled());
      expect(jest.mocked(profile.updateOwnProfile).mock.calls[0][1]).toMatchObject({
        showEmail: false,
      });
    });
  });

  describe('photo', () => {
    it('uploads a newly chosen photo', async () => {
      jest.mocked(pickAvatar).mockResolvedValue({ status: 'picked', uri: 'file:///new.jpg' });
      await openEdit();
      await press(screen.getByTestId('change-photo'));
      await press(screen.getByTestId('photo-choose'));
      await waitFor(() =>
        expect(profile.uploadAvatar).toHaveBeenCalledWith(uid(), 'file:///new.jpg'),
      );
    });

    it('does nothing if the member cancels the picker', async () => {
      jest.mocked(pickAvatar).mockResolvedValue({ status: 'canceled' });
      await openEdit();
      await press(screen.getByTestId('change-photo'));
      await press(screen.getByTestId('photo-choose'));
      await waitFor(() => expect(pickAvatar).toHaveBeenCalled());
      expect(profile.uploadAvatar).not.toHaveBeenCalled();
    });

    it('explains how to allow photo access when it was denied', async () => {
      jest.mocked(pickAvatar).mockResolvedValue({ status: 'denied' });
      const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
      await openEdit();
      await press(screen.getByTestId('change-photo'));
      await press(screen.getByTestId('photo-choose'));
      await waitFor(() =>
        expect(
          screen.getByText('Allow photo access in Settings to choose a profile photo.'),
        ).toBeTruthy(),
      );
      await press(screen.getByRole('button', { name: 'Open Settings' }));
      expect(open).toHaveBeenCalled();
    });

    it('shows an error if the upload fails', async () => {
      jest.mocked(pickAvatar).mockResolvedValue({ status: 'picked', uri: 'file:///new.jpg' });
      profile.uploadAvatar.mockRejectedValueOnce(new Error('storage/unauthorized'));
      await openEdit();
      await press(screen.getByTestId('change-photo'));
      await press(screen.getByTestId('photo-choose'));
      await waitFor(() =>
        expect(screen.getByText('Couldn’t update your photo. Try again.')).toBeTruthy(),
      );
    });

    it('offers Remove photo only when there is one', async () => {
      await openEdit();
      await press(screen.getByTestId('change-photo'));
      expect(screen.queryByTestId('photo-remove')).toBeNull();
    });

    it('removes an existing photo', async () => {
      profile.resetProfileMock(profile.sampleProfile({ photoURL: 'https://cdn.test/me.jpg' }));
      await openEdit();
      await press(screen.getByTestId('change-photo'));
      await press(screen.getByTestId('photo-remove'));
      await waitFor(() => expect(profile.removeAvatar).toHaveBeenCalledWith(uid()));
    });
  });
});
