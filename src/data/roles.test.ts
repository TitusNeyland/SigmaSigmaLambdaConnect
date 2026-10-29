import { deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';

import { parseRoleDoc, removeRole, setRole, subscribeToRole } from './roles';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  onSnapshot: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

type SnapHandler = (snap: { exists(): boolean; data(): Record<string, unknown> }) => void;

function captureSnapshot() {
  const onChange = jest.fn();
  const onError = jest.fn();
  const unsubscribe = jest.fn();
  jest.mocked(onSnapshot).mockReturnValue(unsubscribe as never);
  const stop = subscribeToRole('u1', onChange, onError);
  const [ref, next, error] = jest.mocked(onSnapshot).mock.calls[0] as unknown as [
    unknown,
    SnapHandler,
    (e: unknown) => void,
  ];
  return { ref, next, error, onChange, onError, stop, unsubscribe };
}

beforeEach(() => jest.clearAllMocks());

describe('parseRoleDoc', () => {
  it('reads an officer with a title', () => {
    expect(parseRoleDoc({ role: 'officer', title: 'Treasurer' })).toEqual({
      role: 'officer',
      title: 'Treasurer',
    });
  });

  it('reads an admin without a title', () => {
    expect(parseRoleDoc({ role: 'admin' })).toEqual({ role: 'admin' });
  });

  it('drops a blank title', () => {
    expect(parseRoleDoc({ role: 'officer', title: '   ' })).toEqual({ role: 'officer' });
  });

  it.each([undefined, {}, { role: 'superuser' }, { role: 1 }, { title: 'President' }])(
    'treats %p as no role',
    (data) => {
      expect(parseRoleDoc(data as Record<string, unknown> | undefined)).toBeNull();
    },
  );
});

describe('subscribeToRole', () => {
  it('listens to the roles document for that person', () => {
    const { ref } = captureSnapshot();
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'roles', 'u1');
    expect(ref).toEqual({ path: 'roles/u1' });
  });

  it('passes the role through', () => {
    const { next, onChange } = captureSnapshot();
    next({ exists: () => true, data: () => ({ role: 'officer', title: 'Secretary' }) });
    expect(onChange).toHaveBeenCalledWith({ role: 'officer', title: 'Secretary' });
  });

  it('reports null when there is no roles document', () => {
    const { next, onChange } = captureSnapshot();
    next({ exists: () => false, data: () => ({}) });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reports null for a malformed roles document', () => {
    const { next, onChange } = captureSnapshot();
    next({ exists: () => true, data: () => ({ role: 'king' }) });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('forwards errors and returns the unsubscribe function', () => {
    const { error, onError, stop, unsubscribe } = captureSnapshot();
    const failure = new Error('permission-denied');
    error(failure);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(stop).toBe(unsubscribe);
  });
});

describe('setRole', () => {
  it('writes the role and trimmed title', async () => {
    await setRole('u2', { role: 'officer', title: '  Service Chair ' });
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'roles/u2' },
      { role: 'officer', title: 'Service Chair' },
    );
  });

  it('leaves off an empty title, matching the rules', async () => {
    await setRole('u2', { role: 'admin', title: ' ' });
    expect(setDoc).toHaveBeenCalledWith({ path: 'roles/u2' }, { role: 'admin' });
  });

  it('rejects unknown roles before writing', async () => {
    await expect(setRole('u2', { role: 'superuser' as never })).rejects.toThrow('Unknown role');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('rejects titles over 40 characters before writing', async () => {
    await expect(setRole('u2', { role: 'officer', title: 'a'.repeat(41) })).rejects.toThrow(
      '40 characters',
    );
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('removeRole', () => {
  it('deletes the roles document', async () => {
    await removeRole('u2');
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'roles/u2' });
  });
});
