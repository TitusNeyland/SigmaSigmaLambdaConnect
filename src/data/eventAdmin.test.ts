import { setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { cancelEvent, createEvent, newEventId, updateEvent, uploadEventPhoto } from './eventAdmin';

jest.mock('./firebase', () => ({ db: { name: 'db' }, storage: { name: 'storage' } }));
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    mockMs: number;
    constructor(mockMs: number) {
      this.mockMs = mockMs;
    }
    static fromDate(d: Date) {
      return new MockTimestamp(d.getTime());
    }
  }
  return {
    Timestamp: MockTimestamp,
    collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
    doc: jest.fn((parent: { collection?: string }, ...segments: string[]) =>
      segments.length ? { path: segments.join('/') } : { id: 'generated-id' },
    ),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteField: jest.fn(() => 'DELETE'),
    serverTimestamp: jest.fn(() => 'NOW'),
  };
});
jest.mock('firebase/storage', () => ({
  ref: jest.fn((_s: unknown, path: string) => ({ path })),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(async () => 'https://cdn.test/e.jpg'),
}));

const start = new Date('2026-11-08T01:00:00Z');
const input = {
  title: 'Gala',
  category: 'fundraiser' as const,
  location: 'Ballroom',
  address: '200 Sample Ave',
  description: 'About',
  startsAt: start,
  endsAt: new Date(start.getTime() + 3 * 3600_000),
  rsvpDeadline: new Date(start.getTime() - 24 * 3600_000),
  feeCents: 2500,
  photoURL: null,
};
const ts = (d: Date) => Timestamp.fromDate(d);

beforeEach(() => jest.clearAllMocks());

it('makes an ID up front', () => {
  expect(newEventId()).toBe('generated-id');
});

it('creates an event as the officer, not cancelled', async () => {
  await createEvent('gala', 'olivia', input);
  expect(setDoc).toHaveBeenCalledWith(
    { path: 'events/gala' },
    {
      title: 'Gala',
      category: 'fundraiser',
      location: 'Ballroom',
      address: '200 Sample Ave',
      description: 'About',
      startsAt: ts(start),
      endsAt: ts(input.endsAt),
      rsvpDeadline: ts(input.rsvpDeadline),
      feeCents: 2500,
      photoURL: null,
      cancelled: false,
      createdBy: 'olivia',
      createdAt: 'NOW',
    },
  );
});

it('leaves out an empty address and end time when creating', async () => {
  await createEvent('gala', 'olivia', { ...input, address: '', endsAt: null });
  const written = jest.mocked(setDoc).mock.calls[0][1] as Record<string, unknown>;
  expect(written).not.toHaveProperty('address');
  expect(written).not.toHaveProperty('endsAt');
});

it('edits without touching who made it, and clears removed fields', async () => {
  await updateEvent('gala', { ...input, address: '', endsAt: null });
  const written = jest.mocked(updateDoc).mock.calls[0][1] as unknown as Record<string, unknown>;
  expect(written).toMatchObject({ title: 'Gala', address: 'DELETE', endsAt: 'DELETE' });
  expect(written).not.toHaveProperty('createdBy');
  expect(written).not.toHaveProperty('createdAt');
  expect(written).not.toHaveProperty('cancelled');
});

it('cancels by marking it cancelled', async () => {
  await cancelEvent('gala');
  expect(updateDoc).toHaveBeenCalledWith({ path: 'events/gala' }, { cancelled: true });
});

it('uploads the photo under the event and returns its URL', async () => {
  global.fetch = jest.fn(async () => ({ blob: async () => ({ size: 1 }) })) as never;
  expect(await uploadEventPhoto('gala', 'file:///photo.jpg')).toBe('https://cdn.test/e.jpg');
  expect(jest.mocked(ref).mock.calls[0][1]).toMatch(/^events\/gala\/\d+\.jpg$/);
  expect(uploadBytes).toHaveBeenCalledWith(
    expect.anything(),
    { size: 1 },
    {
      contentType: 'image/jpeg',
    },
  );
  expect(getDownloadURL).toHaveBeenCalled();
});
