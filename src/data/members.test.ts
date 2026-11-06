import { doc, onSnapshot, writeBatch } from 'firebase/firestore';

import { createPendingProfile, subscribeToOwnMember } from './members';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  writeBatch: jest.fn(),
}));

const batch = { set: jest.fn(), commit: jest.fn(async () => {}) };

type Snap = {
  exists(): boolean;
  data(): Record<string, unknown>;
  metadata?: { hasPendingWrites: boolean };
};
type SnapHandler = (snap: Snap) => void;

function captureSnapshot() {
  const onChange = jest.fn();
  const onError = jest.fn();
  const unsubscribe = jest.fn();
  jest.mocked(onSnapshot).mockReturnValue(unsubscribe as never);
  const stop = subscribeToOwnMember('u1', onChange, onError);
  const [ref, options, handler, error] = jest.mocked(onSnapshot).mock.calls[0] as unknown as [
    unknown,
    unknown,
    SnapHandler,
    (e: unknown) => void,
  ];
  // Snapshots from the server unless a test says otherwise.
  const next = (snap: Snap) => handler({ metadata: { hasPendingWrites: false }, ...snap });
  return { ref, options, next, error, onChange, onError, stop, unsubscribe };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(writeBatch).mockReturnValue(batch as never);
});

describe('subscribeToOwnMember', () => {
  it('waits for the server to confirm the phone’s own writes', () => {
    const { options, next, onChange } = captureSnapshot();
    expect(options).toEqual({ includeMetadataChanges: true });
    // Sign up's profile, shown locally before the server checked it: ignored.
    next({
      exists: () => true,
      data: () => ({
        displayName: 'Marcus Reed',
        initiationTerm: 'Spring 2019',
        status: 'pending',
      }),
      metadata: { hasPendingWrites: true },
    });
    expect(onChange).not.toHaveBeenCalled();
    // The server said no, so it's gone again: still no profile.
    next({ exists: () => false, data: () => ({}) });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('listens to the member’s own profile document', () => {
    const { ref } = captureSnapshot();
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'members', 'u1');
    expect(ref).toEqual({ path: 'members/u1' });
  });

  it('passes the profile summary through', () => {
    const { next, onChange } = captureSnapshot();
    next({
      exists: () => true,
      data: () => ({
        displayName: 'Marcus Reed',
        initiationTerm: 'Spring 2019',
        status: 'approved',
        bio: 'ignored here',
      }),
    });
    expect(onChange).toHaveBeenCalledWith({
      displayName: 'Marcus Reed',
      initiationTerm: 'Spring 2019',
      status: 'approved',
    });
  });

  it('reports null when there is no profile yet', () => {
    const { next, onChange } = captureSnapshot();
    next({ exists: () => false, data: () => ({}) });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('treats a profile with no status as pending', () => {
    const { next, onChange } = captureSnapshot();
    next({ exists: () => true, data: () => ({ displayName: 'A', initiationTerm: 'B' }) });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });

  it('forwards errors and returns the unsubscribe function', () => {
    const { error, onError, stop, unsubscribe } = captureSnapshot();
    error(new Error('offline'));
    expect(onError).toHaveBeenCalledWith(new Error('offline'));
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('createPendingProfile', () => {
  it('writes a trimmed pending profile with only fields the rules allow', async () => {
    await createPendingProfile('u1', {
      displayName: ' Marcus Reed ',
      initiationTerm: ' Spring 2019 ',
      email: 'marcus@example.com',
    });
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'members/u1' },
      {
        displayName: 'Marcus Reed',
        initiationTerm: 'Spring 2019',
        status: 'pending',
        createdAt: 'SERVER_TIMESTAMP',
      },
    );
    expect(batch.commit).toHaveBeenCalled();
  });

  it('keeps the email private and hidden', async () => {
    await createPendingProfile('u1', { displayName: 'A', initiationTerm: 'B', email: 'a@b.co' });
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'members/u1/private/contact' },
      expect.objectContaining({ email: 'a@b.co', showEmail: false, showPhone: false }),
    );
  });

  it('stores an empty email when the account has none', async () => {
    await createPendingProfile('u1', { displayName: 'A', initiationTerm: 'B', email: null });
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'members/u1/private/contact' },
      expect.objectContaining({ email: '' }),
    );
  });
});
