import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { auth as firebaseAuth } from './firebase';
import {
  refreshUser,
  resendVerificationEmail,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
} from './auth';

jest.mock('./firebase', () => ({
  auth: { name: 'auth', currentUser: null as unknown },
  db: { name: 'db' },
}));
jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  onAuthStateChanged: jest.fn(),
  reload: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
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
      firebaseAuth,
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
      firebaseAuth,
      'marcus@example.com',
      'pw',
    );
  });

  it('signs out', async () => {
    await signOut();
    expect(firebaseSignOut).toHaveBeenCalledWith(firebaseAuth);
  });
});

type MutableAuth = { currentUser: unknown };
const setCurrentUser = (u: unknown) => {
  (firebaseAuth as unknown as MutableAuth).currentUser = u;
};

describe('resendVerificationEmail', () => {
  afterEach(() => setCurrentUser(null));

  it('sends to the signed-in user', async () => {
    const current = { uid: 'u1' };
    setCurrentUser(current);
    await resendVerificationEmail();
    expect(sendEmailVerification).toHaveBeenCalledWith(current);
  });

  it('fails when nobody is signed in', async () => {
    setCurrentUser(null);
    await expect(resendVerificationEmail()).rejects.toThrow('Not signed in');
  });
});

describe('refreshUser', () => {
  afterEach(() => setCurrentUser(null));

  it('reloads and returns the fresh verified state', async () => {
    const current = { uid: 'u1', email: 'a@example.com', emailVerified: false, displayName: 'A' };
    setCurrentUser(current);
    jest.mocked(reload).mockImplementation(async () => {
      current.emailVerified = true;
    });
    await expect(refreshUser()).resolves.toEqual({
      uid: 'u1',
      email: 'a@example.com',
      emailVerified: true,
      displayName: 'A',
    });
    expect(reload).toHaveBeenCalledWith(current);
  });

  it('returns null when signed out', async () => {
    setCurrentUser(null);
    await expect(refreshUser()).resolves.toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('sendPasswordReset', () => {
  it('sends to the normalized email', async () => {
    await sendPasswordReset(' Marcus@Example.com ');
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(firebaseAuth, 'marcus@example.com');
  });

  it.each(['auth/user-not-found', 'auth/invalid-email'])(
    'treats %s as success so accounts stay private',
    async (code) => {
      jest.mocked(sendPasswordResetEmail).mockRejectedValueOnce({ code });
      await expect(sendPasswordReset('nobody@example.com')).resolves.toBeUndefined();
    },
  );

  it('passes other errors through so the screen can explain them', async () => {
    jest
      .mocked(sendPasswordResetEmail)
      .mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    await expect(sendPasswordReset('a@example.com')).rejects.toEqual({
      code: 'auth/network-request-failed',
    });
  });
});
