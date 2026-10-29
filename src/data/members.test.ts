import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { createPendingProfile, subscribeToOwnMember } from './members';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  setDoc: jest.fn(),
}));

type SnapHandler = (snap: { exists(): boolean; data(): Record<string, unknown> }) => void;

function captureSnapshot() {
  const onChange = jest.fn();
  const onError = jest.fn();
  const unsubscribe = jest.fn();
  jest.mocked(onSnapshot).mockReturnValue(unsubscribe as never);
  const stop = subscribeToOwnMember('u1', onChange, onError);
  const [ref, next, error] = jest.mocked(onSnapshot).mock.calls[0] as unknown as [
    unknown,
    SnapHandler,
    (e: unknown) => void,
  ];
  return { ref, next, error, onChange, onError, stop, unsubscribe };
}

beforeEach(() => jest.clearAllMocks());

describe('subscribeToOwnMember', () => {
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
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'members/u1' },
      {
        displayName: 'Marcus Reed',
        initiationTerm: 'Spring 2019',
        email: 'marcus@example.com',
        status: 'pending',
        createdAt: 'SERVER_TIMESTAMP',
      },
    );
  });

  it('leaves out the email when the account has none', async () => {
    await createPendingProfile('u1', { displayName: 'A', initiationTerm: 'B', email: null });
    expect(jest.mocked(setDoc).mock.calls[0][1]).not.toHaveProperty('email');
  });
});
