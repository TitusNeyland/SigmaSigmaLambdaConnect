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
    initiationDate: null,
    headline: 'Teacher',
    industry: '',
    businesses: [],
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
  upcoming: { state: 'ready', data: [] },
  onRefresh: jest.fn(),
  onOpenPost: jest.fn(),
  onOpenEvent: jest.fn(),
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

  it('always shows posts, events and service hours, and the Photos and Activity tabs', async () => {
    await render(<ProfileView {...baseProps()} />);
    expect(screen.getByLabelText('3 Posts')).toBeTruthy();
    expect(screen.getByLabelText('5 Events')).toBeTruthy();
    expect(screen.getByLabelText('12.5 Service hrs')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Photos' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeTruthy();
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
    expect(screen.getByLabelText('Loading posts')).toBeTruthy();
  });

  it('shows the role badge when given one', async () => {
    await render(<ProfileView {...baseProps({ roleLabel: 'Service Chair' })} />);
    expect(screen.getByTestId('role-chip')).toHaveTextContent('Service Chair');
  });
});

describe('about him', () => {
  it('shows his line of work and the businesses he owns', async () => {
    await render(
      <ProfileView
        {...baseProps({
          profile: {
            ...baseProps().profile,
            industry: 'Real estate',
            businesses: ['Sample Realty', 'Sample Barbershop'],
          },
        })}
      />,
    );
    expect(screen.getByTestId('profile-industry')).toHaveTextContent('Works in Real estate');
    expect(screen.getByTestId('profile-businesses')).toHaveTextContent(
      'Owns Sample Realty and Sample Barbershop',
    );
  });

  it('leaves them out when he hasn’t said', async () => {
    await render(<ProfileView {...baseProps()} />);
    expect(screen.queryByTestId('profile-industry')).toBeNull();
    expect(screen.queryByTestId('profile-businesses')).toBeNull();
  });
});

describe('Activity', () => {
  const soon = new Date(Date.now() + 3 * 86_400_000);
  const event = {
    id: 'e1',
    title: 'Sample food drive',
    category: 'service' as const,
    description: '',
    startsAt: soon,
    endsAt: null,
    location: 'Sample hall',
    photoURL: null,
    cancelled: false,
    myRsvp: 'going' as const,
    slots: null,
    goingCount: null,
  };
  const timelineProps = (overrides: Partial<ProfileViewProps> = {}) =>
    baseProps({
      profile: { ...baseProps().profile, initiationDate: new Date(2020, 0, 15) },
      upcoming: { state: 'ready', data: [event] },
      posts: {
        state: 'ready',
        data: [
          {
            id: 'p1',
            coverPath: null,
            photoCount: 0,
            caption: 'Great turnout',
            createdAt: new Date(2026, 9, 2),
          },
        ],
      },
      activity: {
        state: 'ready',
        data: [
          {
            eventId: 'e0',
            title: 'Sample service day',
            startsAt: new Date(2026, 9, 3),
            location: 'Food bank',
            serviceHours: 4,
          },
        ],
      },
      ...overrides,
    });

  async function openActivity(props: ProfileViewProps) {
    await render(<ProfileView {...props} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Activity' }));
  }

  it('lists what’s coming up, then what he’s done, and each row opens it', async () => {
    const props = timelineProps();
    await openActivity(props);
    expect(screen.getByTestId('activity-upcoming')).toHaveTextContent(/COMING UP/);
    expect(screen.getByTestId('activity-going-e1')).toHaveTextContent(/Sample food drive/);
    expect(screen.getByTestId('activity-going-e1')).toHaveTextContent(/Going · Sample hall/);
    expect(screen.getByTestId('activity-attended-e0')).toHaveTextContent(
      /Attended · Food bank · 4 service hours/,
    );
    expect(screen.getByTestId('activity-posted-p1')).toHaveTextContent(/Shared a post/);
    expect(screen.getByTestId('activity-initiated-0')).toHaveTextContent(
      /Initiated into Sigma Sigma Lambda/,
    );
    expect(screen.getByTestId('activity-initiated-1')).toHaveTextContent(
      /Line anniversary: 1 year/,
    );

    await fireEvent.press(screen.getByTestId('activity-going-e1'));
    expect(props.onOpenEvent).toHaveBeenCalledWith('e1');
    await fireEvent.press(screen.getByTestId('activity-attended-e0'));
    expect(props.onOpenEvent).toHaveBeenCalledWith('e0');
    await fireEvent.press(screen.getByTestId('activity-posted-p1'));
    expect(props.onOpenPost).toHaveBeenCalledWith('p1');
    // Anniversaries are just a note.
    expect(screen.getByTestId('activity-initiated-1').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('shows check-ins and says who can see them only when the viewer is allowed', async () => {
    await openActivity(timelineProps({ own: true }));
    expect(screen.getByText('Only you and chapter officers can see your check-ins.')).toBeTruthy();
  });

  it('leaves check-ins out for other brothers, keeping the rest', async () => {
    await openActivity(timelineProps({ activity: { state: 'ready', data: null } }));
    expect(screen.queryByTestId('activity-attended-e0')).toBeNull();
    expect(screen.getByTestId('activity-going-e1')).toBeTruthy();
    expect(screen.queryByText(/can see/)).toBeNull();
  });

  it('says when there’s nothing yet, and offers a retry when it can’t load', async () => {
    await openActivity(baseProps({ own: true }));
    expect(screen.getByText('Your posts, RSVPs and check-ins will show up here.')).toBeTruthy();
    const props = baseProps({ upcoming: { state: 'error' } });
    await openActivity(props);
    expect(screen.getByText('Couldn’t load activity.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(props.onRefresh).toHaveBeenCalled();
  });
});
