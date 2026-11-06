import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  formatHours,
  gridTileSize,
  profileSubtitle,
  ProfileView,
  type ProfileViewProps,
} from './ProfileView';

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
  stats: { state: 'ready', data: { posts: 3, eventsAttended: 5, serviceHours: 12.5 } },
  posts: { state: 'ready', data: [] },
  activity: { state: 'ready', data: null },
  onRefresh: jest.fn(),
  onOpenPost: jest.fn(),
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

describe('gridTileSize', () => {
  it.each([320, 375, 390, 430, 768])('fits three squares and two gaps in %p points', (width) => {
    const size = gridTileSize(width);
    expect(size * 3 + 2 * 2).toBeLessThanOrEqual(width);
    expect(size * 3 + 2 * 2).toBeGreaterThan(width - 3);
  });
});

describe('ProfileView', () => {
  it('lays posts out as equal squares, three to a row', async () => {
    const posts = ['a', 'b', 'c', 'd'].map((id) => ({
      id,
      coverPath: `posts/u/${id}/0.jpg`,
      photoCount: 1,
      caption: `Post ${id}`,
      createdAt: null,
    }));
    await render(<ProfileView {...baseProps({ posts: { state: 'ready', data: posts } })} />);
    await fireEvent(screen.getByTestId('profile-grid'), 'layout', {
      nativeEvent: { layout: { width: 390, height: 0, x: 0, y: 0 } },
    });
    for (const id of ['a', 'b', 'c', 'd']) {
      const style = StyleSheet.flatten(screen.getByTestId(`profile-post-${id}`).props.style);
      expect(style).toMatchObject({ width: 128, height: 128 });
    }
  });

  it('always shows posts, events and service hours, but the Activity tab only when allowed', async () => {
    await render(<ProfileView {...baseProps()} />);
    expect(screen.getByLabelText('3 Posts')).toBeTruthy();
    expect(screen.getByLabelText('5 Events')).toBeTruthy();
    expect(screen.getByLabelText('12.5 Service hrs')).toBeTruthy();
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
