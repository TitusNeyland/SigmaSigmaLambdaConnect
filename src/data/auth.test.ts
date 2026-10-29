import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { signIn, signOut, signUp } from './auth';

jest.mock('./firebase', () => ({ auth: { name: 'auth' }, db: { name: 'db' } }));
jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendEmailVerification: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  setDoc: jest.fn(),
}));

const user = { uid: 'new-uid' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createUserWithEmailAndPassword).mockResolvedValue({ user } as never);
  jest.mocked(updateProfile).mockResolvedValue(undefined);
  jest.mocked(setDoc).mockResolvedValue(undefined);
  jest.mocked(sendEmailVerification).mockResolvedValue(undefined);
});

describe('signUp', () => {
  const input = {
    displayName: '  Marcus Reed ',
    initiationTerm: ' Spring 2019 ',
    email: '  Marcus@Example.com ',
    password: 'brother2019',
  };

  it('creates the account with a normalized email', async () => {
    await signUp(input);
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      { name: 'auth' },
      'marcus@example.com',
      'brother2019',
    );
  });

  it('sets the display name', async () => {
    await signUp(input);
    expect(updateProfile).toHaveBeenCalledWith(user, { displayName: 'Marcus Reed' });
  });

  it('writes a pending member profile with exactly the fields the rules allow', async () => {
    await signUp(input);
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'members', 'new-uid');
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'members/new-uid' },
      {
        displayName: 'Marcus Reed',
        initiationTerm: 'Spring 2019',
        email: 'marcus@example.com',
        status: 'pending',
        createdAt: 'SERVER_TIMESTAMP',
      },
    );
  });

  it('sends a verification email', async () => {
    await signUp(input);
    expect(sendEmailVerification).toHaveBeenCalledWith(user);
  });

  it('still succeeds if the verification email fails to send', async () => {
    jest.mocked(sendEmailVerification).mockRejectedValue(new Error('quota'));
    await expect(signUp(input)).resolves.toBeUndefined();
  });

  it('does not write a profile when the account cannot be created', async () => {
    jest
      .mocked(createUserWithEmailAndPassword)
      .mockRejectedValue({ code: 'auth/email-already-in-use' });
    await expect(signUp(input)).rejects.toEqual({ code: 'auth/email-already-in-use' });
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('signIn and signOut', () => {
  it('signs in with a normalized email', async () => {
    await signIn(' Marcus@Example.com', 'pw');
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      { name: 'auth' },
      'marcus@example.com',
      'pw',
    );
  });

  it('signs out', async () => {
    await signOut();
    expect(firebaseSignOut).toHaveBeenCalledWith({ name: 'auth' });
  });
});
