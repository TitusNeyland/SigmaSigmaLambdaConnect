import {
  collection,
  collectionGroup,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import {
  acceptGuidelines,
  fetchActivity,
  fetchProfilePosts,
  fetchProfileStats,
  photoUrl,
  removeAvatar,
  setNotificationPref,
  subscribeToProfile,
  toContact,
  toProfile,
  updateOwnProfile,
  withContact,
  uploadAvatar,
} from './profile';

jest.mock('./firebase', () => ({ db: { name: 'db' }, storage: { name: 'storage' } }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  collection: jest.fn((_db: unknown, path: string) => ({ collection: path })),
  collectionGroup: jest.fn((_db: unknown, id: string) => ({ collectionGroup: id })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ where: [field, op, value] })),
  orderBy: jest.fn((field: string, dir: string) => ({ orderBy: [field, dir] })),
  limit: jest.fn((n: number) => ({ limit: n })),
  query: jest.fn((base: object, ...parts: object[]) => ({ base, parts })),
  count: jest.fn(() => 'COUNT'),
  sum: jest.fn((field: string) => `SUM(${field})`),
  onSnapshot: jest.fn(),
  getAggregateFromServer: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  deleteField: jest.fn(() => 'DELETE'),
  writeBatch: jest.fn(),
}));
jest.mock('firebase/storage', () => ({
  ref: jest.fn((_s: unknown, path: string) => ({ storagePath: path })),
  getDownloadURL: jest.fn(
    async (r: { storagePath: string }) => `https://cdn.test/${r.storagePath}`,
  ),
  uploadBytes: jest.fn(async () => ({})),
}));

beforeEach(() => jest.clearAllMocks());

const agg = (data: Record<string, number | null>) => ({ data: () => data });

describe('toProfile', () => {
  it('reads every profile field', () => {
    expect(
      toProfile({
        displayName: 'Marcus Reed',
        initiationTerm: 'Spring 2019',
        headline: 'Software engineer',
        bio: 'Mentoring chair.',
        interests: ['Tech', 'Mentoring'],
        photoURL: 'https://cdn.test/a.jpg',
        status: 'approved',
        guidelinesAcceptedAt: { seconds: 1 },
      }),
    ).toEqual({
      displayName: 'Marcus Reed',
      initiationTerm: 'Spring 2019',
      headline: 'Software engineer',
      bio: 'Mentoring chair.',
      interests: ['Tech', 'Mentoring'],
      photoURL: 'https://cdn.test/a.jpg',
      email: '',
      phone: '',
      showEmail: false,
      showPhone: false,
      notificationPrefs: { events: true, announcements: true, social: true, tasks: false },
      guidelinesAccepted: true,
    });
  });

  it('fills missing or bad fields with safe defaults', () => {
    expect(
      toProfile({ displayName: 'A', interests: ['Tech', 3, ' ', null], photoURL: '' }),
    ).toEqual({
      displayName: 'A',
      initiationTerm: '',
      headline: '',
      bio: '',
      interests: ['Tech'],
      photoURL: null,
      email: '',
      phone: '',
      showEmail: false,
      showPhone: false,
      notificationPrefs: { events: true, announcements: true, social: true, tasks: false },
      guidelinesAccepted: false,
    });
  });

  it('reads stored notification preferences over the defaults', () => {
    expect(
      toProfile({ notificationPrefs: { events: false, tasks: true, social: 'no', junk: true } })
        .notificationPrefs,
    ).toEqual({ events: false, announcements: true, social: true, tasks: true });
  });

  it('treats contact details on the public doc as shown, and missing ones as hidden', () => {
    expect(toProfile({ email: 'm@example.com', showEmail: false })).toMatchObject({
      email: 'm@example.com',
      phone: '',
      showEmail: true,
      showPhone: false,
    });
  });
});

describe('private contact settings', () => {
  it('reads the contact doc and treats anything but true as hidden', () => {
    expect(
      toContact({ email: 'm@example.com', phone: '555-0100', showEmail: 'yes', showPhone: true }),
    ).toEqual({ email: 'm@example.com', phone: '555-0100', showEmail: false, showPhone: true });
  });

  it('layers the private values over the public profile', () => {
    const shown = toProfile({ displayName: 'Marcus Reed' });
    expect(
      withContact(shown, { email: 'm@x.co', phone: '555-0100', showEmail: false, showPhone: true }),
    ).toMatchObject({
      displayName: 'Marcus Reed',
      email: 'm@x.co',
      phone: '555-0100',
      showEmail: false,
      showPhone: true,
    });
    expect(withContact(shown, null)).toBe(shown);
  });
});

describe('subscribeToProfile', () => {
  it('listens to the member document and maps it', () => {
    const onChange = jest.fn();
    subscribeToProfile('u1', onChange, jest.fn());
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'members', 'u1');
    const next = jest.mocked(onSnapshot).mock.calls[0][1] as unknown as (s: object) => void;
    next({ exists: () => true, data: () => ({ displayName: 'Marcus Reed' }) });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ displayName: 'Marcus Reed' }),
    );
    next({ exists: () => false, data: () => ({}) });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('does not read the private contact doc for someone else', () => {
    subscribeToProfile('u1', jest.fn(), jest.fn());
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  it('for the member’s own profile, waits for both docs and merges them', () => {
    const onChange = jest.fn();
    const stops = [jest.fn(), jest.fn()];
    jest
      .mocked(onSnapshot)
      .mockReturnValueOnce(stops[0] as never)
      .mockReturnValueOnce(stops[1] as never);
    const stop = subscribeToProfile('u1', onChange, jest.fn(), { own: true });
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'members/u1/private/contact');
    const [member, contact] = jest
      .mocked(onSnapshot)
      .mock.calls.map((c) => c[1] as unknown as (s: object) => void);
    member({ exists: () => true, data: () => ({ displayName: 'Marcus Reed' }) });
    expect(onChange).not.toHaveBeenCalled();
    contact({
      exists: () => true,
      data: () => ({ email: 'm@x.co', phone: '555-0100', showEmail: true, showPhone: false }),
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ displayName: 'Marcus Reed', phone: '555-0100', showEmail: true }),
    );
    stop();
    expect(stops[0]).toHaveBeenCalled();
    expect(stops[1]).toHaveBeenCalled();
  });
});

describe('fetchProfileStats', () => {
  it('counts only visible posts by that member', async () => {
    jest.mocked(getAggregateFromServer).mockResolvedValueOnce(agg({ posts: 4 }) as never);
    await fetchProfileStats('u1', { includeAttendance: false });
    expect(collection).toHaveBeenCalledWith({ name: 'db' }, 'posts');
    expect(where).toHaveBeenCalledWith('authorId', '==', 'u1');
    expect(where).toHaveBeenCalledWith('removed', '==', false);
  });

  it('leaves attendance out unless allowed, so the rules never reject the query', async () => {
    jest.mocked(getAggregateFromServer).mockResolvedValueOnce(agg({ posts: 4 }) as never);
    await expect(fetchProfileStats('u1', { includeAttendance: false })).resolves.toEqual({
      posts: 4,
      eventsAttended: null,
      serviceHours: null,
    });
    expect(getAggregateFromServer).toHaveBeenCalledTimes(1);
    expect(collectionGroup).not.toHaveBeenCalled();
  });

  it('counts attended events and sums service hours across events', async () => {
    jest
      .mocked(getAggregateFromServer)
      .mockResolvedValueOnce(agg({ posts: 2 }) as never)
      .mockResolvedValueOnce(agg({ events: 9, hours: 32 }) as never);
    await expect(fetchProfileStats('u1', { includeAttendance: true })).resolves.toEqual({
      posts: 2,
      eventsAttended: 9,
      serviceHours: 32,
    });
    expect(collectionGroup).toHaveBeenCalledWith({ name: 'db' }, 'attendance');
    expect(where).toHaveBeenCalledWith('memberId', '==', 'u1');
    expect(jest.mocked(getAggregateFromServer).mock.calls[1][1]).toEqual({
      events: 'COUNT',
      hours: 'SUM(serviceHours)',
    });
  });

  it('treats no service hours as zero', async () => {
    jest
      .mocked(getAggregateFromServer)
      .mockResolvedValueOnce(agg({ posts: 0 }) as never)
      .mockResolvedValueOnce(agg({ events: 0, hours: null }) as never);
    await expect(fetchProfileStats('u1', { includeAttendance: true })).resolves.toMatchObject({
      serviceHours: 0,
    });
  });
});

describe('fetchProfilePosts', () => {
  it('returns newest visible posts with their cover photo', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        {
          id: 'p1',
          data: () => ({ caption: 'Service day', photoPaths: ['posts/u1/p1/a.jpg', 'b.jpg'] }),
        },
        { id: 'p2', data: () => ({ caption: 'Text only', photoPaths: [] }) },
      ],
    } as never);
    await expect(fetchProfilePosts('u1')).resolves.toEqual([
      { id: 'p1', coverPath: 'posts/u1/p1/a.jpg', photoCount: 2, caption: 'Service day' },
      { id: 'p2', coverPath: null, photoCount: 0, caption: 'Text only' },
    ]);
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limit).toHaveBeenCalledWith(30);
  });
});

describe('fetchActivity', () => {
  const attendanceDoc = (eventId: string | null, hours?: number) => ({
    ref: { parent: { parent: eventId ? { id: eventId } : null } },
    data: () => (hours === undefined ? {} : { serviceHours: hours }),
  });

  it('lists attended events newest first with their details', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [attendanceDoc('e1', 4), attendanceDoc('e2')],
    } as never);
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce({
        id: 'e1',
        exists: () => true,
        data: () => ({
          title: 'Service Day',
          location: 'Food bank',
          startsAt: { toDate: () => new Date('2026-10-03T14:00:00Z') },
        }),
      } as never)
      .mockResolvedValueOnce({
        id: 'e2',
        exists: () => true,
        data: () => ({ title: 'Chapter Meeting', location: 'Library' }),
      } as never);

    const items = await fetchActivity('u1');
    expect(items).toEqual([
      {
        eventId: 'e1',
        title: 'Service Day',
        location: 'Food bank',
        startsAt: new Date('2026-10-03T14:00:00Z'),
        serviceHours: 4,
      },
      {
        eventId: 'e2',
        title: 'Chapter Meeting',
        location: 'Library',
        startsAt: null,
        serviceHours: 0,
      },
    ]);
    expect(where).toHaveBeenCalledWith('memberId', '==', 'u1');
    expect(orderBy).toHaveBeenCalledWith('checkedInAt', 'desc');
    expect(query).toHaveBeenCalled();
  });

  it('skips attendance for events that were deleted', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [attendanceDoc('gone'), attendanceDoc(null)],
    } as never);
    jest.mocked(getDoc).mockResolvedValueOnce({ id: 'gone', exists: () => false } as never);
    await expect(fetchActivity('u1')).resolves.toEqual([]);
  });
});

describe('photoUrl', () => {
  it('resolves a Storage path to a download URL', async () => {
    await expect(photoUrl('posts/u1/p1/a.jpg')).resolves.toBe('https://cdn.test/posts/u1/p1/a.jpg');
    expect(ref).toHaveBeenCalledWith({ name: 'storage' }, 'posts/u1/p1/a.jpg');
    expect(getDownloadURL).toHaveBeenCalled();
  });
});

describe('acceptGuidelines', () => {
  it('stores the acceptance with the server’s time', async () => {
    await acceptGuidelines('u1');
    expect(updateDoc).toHaveBeenCalledWith(
      { path: 'members/u1' },
      { guidelinesAcceptedAt: 'SERVER_TIMESTAMP', updatedAt: 'SERVER_TIMESTAMP' },
    );
  });
});

describe('updateOwnProfile', () => {
  const batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn(async () => {}) };
  beforeEach(() => jest.mocked(writeBatch).mockReturnValue(batch as never));

  const patch = {
    displayName: 'Marcus Reed',
    initiationTerm: 'Spring 2019',
    headline: 'Engineer',
    bio: 'Hi',
    interests: ['Tech'],
    phone: '555-0100',
    showEmail: true,
    showPhone: false,
  };

  it('keeps the real contact details in the private doc', async () => {
    await updateOwnProfile('u1', patch, { email: ' m@x.co ' });
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'members/u1/private/contact' },
      {
        email: 'm@x.co',
        phone: '555-0100',
        showEmail: true,
        showPhone: false,
        updatedAt: 'SERVER_TIMESTAMP',
      },
    );
    expect(batch.commit).toHaveBeenCalled();
  });

  it('puts only shown contact details on the public doc, never status', async () => {
    await updateOwnProfile('u1', patch, { email: 'm@x.co' });
    expect(batch.update).toHaveBeenCalledWith(
      { path: 'members/u1' },
      {
        displayName: 'Marcus Reed',
        initiationTerm: 'Spring 2019',
        headline: 'Engineer',
        bio: 'Hi',
        interests: ['Tech'],
        email: 'm@x.co',
        phone: 'DELETE',
        updatedAt: 'SERVER_TIMESTAMP',
      },
    );
  });

  it('removes both from the public doc when both are hidden', async () => {
    await updateOwnProfile('u1', { ...patch, showEmail: false }, { email: 'm@x.co' });
    expect(batch.update.mock.calls[0][1]).toMatchObject({ email: 'DELETE', phone: 'DELETE' });
  });
});

describe('uploadAvatar', () => {
  const blob = { size: 1000 };
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({ blob: async () => blob })) as never;
  });

  it('uploads a JPEG under the member’s own avatar folder and saves the URL', async () => {
    const url = await uploadAvatar('u1', 'file:///resized.jpg');
    expect(global.fetch).toHaveBeenCalledWith('file:///resized.jpg');
    const path = jest.mocked(ref).mock.calls[0][1] as string;
    expect(path).toMatch(/^avatars\/u1\/\d+\.jpg$/);
    expect(uploadBytes).toHaveBeenCalledWith({ storagePath: path }, blob, {
      contentType: 'image/jpeg',
    });
    expect(url).toBe(`https://cdn.test/${path}`);
    expect(updateDoc).toHaveBeenCalledWith(
      { path: 'members/u1' },
      { photoURL: url, updatedAt: 'SERVER_TIMESTAMP' },
    );
  });

  it('does not touch the profile if the upload fails', async () => {
    jest.mocked(uploadBytes).mockRejectedValueOnce(new Error('storage/unauthorized'));
    await expect(uploadAvatar('u1', 'file:///resized.jpg')).rejects.toThrow('unauthorized');
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('removeAvatar', () => {
  it('clears the photo URL', async () => {
    await removeAvatar('u1');
    expect(updateDoc).toHaveBeenCalledWith(
      { path: 'members/u1' },
      { photoURL: null, updatedAt: 'SERVER_TIMESTAMP' },
    );
  });
});

describe('setNotificationPref', () => {
  it('updates just that preference', async () => {
    await setNotificationPref('u1', 'social', false);
    expect(updateDoc).toHaveBeenCalledWith(
      { path: 'members/u1' },
      { 'notificationPrefs.social': false, updatedAt: 'SERVER_TIMESTAMP' },
    );
  });
});
