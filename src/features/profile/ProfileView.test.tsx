import { render, screen } from '@testing-library/react-native';

import { formatHours, profileSubtitle, ProfileView, type ProfileViewProps } from './ProfileView';

jest.mock('@/data/profile');

const baseProps = (overrides: Partial<ProfileViewProps> = {}): ProfileViewProps => ({
  profile: {
    displayName: 'Jordan Ellis',
    initiationTerm: 'Fall 2020',
    headline: 'Teacher',
    bio: '',
    interests: [],
    photoURL: null,
    email: '',
    phone: '',
    showEmail: false,
    showPhone: false,
    notificationPrefs: { events: true, announcements: true, social: true, tasks: false },
    guidelinesAccepted: true,
  },
  roleLabel: null,
  stats: { state: 'ready', data: { posts: 3, eventsAttended: null, serviceHours: null } },
  posts: { state: 'ready', data: [] },
  activity: { state: 'ready', data: null },
  onRefresh: jest.fn(),
  ...overrides,
});

describe('profileSubtitle', () => {
  it('joins headline and initiation term', () => {
    expect(profileSubtitle({ headline: 'Teacher', initiationTerm: 'Fall 2020' })).toBe(
      'Teacher · Initiated Fall 2020',
    );
  });

  it('handles either part missing', () => {
    expect(profileSubtitle({ headline: ' ', initiationTerm: 'Fall 2020' })).toBe(
      'Initiated Fall 2020',
    );
    expect(profileSubtitle({ headline: 'Teacher', initiationTerm: '' })).toBe('Teacher');
    expect(profileSubtitle({ headline: '', initiationTerm: '' })).toBe('');
  });
});

describe('formatHours', () => {
  it('uses singular and plural correctly and rounds', () => {
    expect(formatHours(1)).toBe('1 service hour');
    expect(formatHours(4)).toBe('4 service hours');
    expect(formatHours(2.25)).toBe('2.3 service hours');
  });
});

describe('ProfileView', () => {
  it('hides attendance and the Activity tab when the viewer may not see them', async () => {
    await render(<ProfileView {...baseProps()} />);
    expect(screen.getByLabelText('3 Posts')).toBeTruthy();
    expect(screen.queryByTestId('stat-events')).toBeNull();
    expect(screen.queryByTestId('stat-hours')).toBeNull();
    expect(screen.queryByTestId('profile-tabs')).toBeNull();
    expect(screen.getByText('No posts yet.')).toBeTruthy();
  });

  it('shows dashes while counts load', async () => {
    await render(
      <ProfileView
        {...baseProps({
          stats: { state: 'loading' },
          posts: { state: 'loading' },
          activity: { state: 'loading' },
        })}
      />,
    );
    expect(screen.getByLabelText('– Posts')).toBeTruthy();
    expect(screen.getByLabelText('– Events')).toBeTruthy();
    expect(screen.getByText('Loading posts…')).toBeTruthy();
  });

  it('shows the role badge when given one', async () => {
    await render(<ProfileView {...baseProps({ roleLabel: 'Service Chair' })} />);
    expect(screen.getByTestId('role-chip')).toHaveTextContent('Service Chair');
  });
});
