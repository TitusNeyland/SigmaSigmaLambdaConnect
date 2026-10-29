import { EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { AccountDeletionError, deleteAccount } from './account';

jest.mock('./firebase', () => ({
  auth: { currentUser: { email: 'marcus@example.com' } },
  functions: { name: 'functions' },
}));
const mockAuth = jest.requireMock<{ auth: { currentUser: { email: string | null } | null } }>(
  './firebase',
).auth;
jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn((email: string, pw: string) => ({ email, pw })) },
  reauthenticateWithCredential: jest.fn(async () => ({})),
  signOut: jest.fn(async () => {}),
}));
const mockCall = jest.fn(async () => ({ data: { deleted: true } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn(() => mockCall) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = { email: 'marcus@example.com' };
});

it('confirms the password, calls the deleteAccount function, then signs out', async () => {
  await deleteAccount('secret123');
  expect(EmailAuthProvider.credential).toHaveBeenCalledWith('marcus@example.com', 'secret123');
  expect(reauthenticateWithCredential).toHaveBeenCalledWith(mockAuth.currentUser, {
    email: 'marcus@example.com',
    pw: 'secret123',
  });
  expect(httpsCallable).toHaveBeenCalledWith({ name: 'functions' }, 'deleteAccount');
  expect(mockCall).toHaveBeenCalled();
  expect(signOut).toHaveBeenCalled();
  const order = [
    jest.mocked(reauthenticateWithCredential).mock.invocationCallOrder[0],
    mockCall.mock.invocationCallOrder[0],
    jest.mocked(signOut).mock.invocationCallOrder[0],
  ];
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

it.each([
  ['auth/wrong-password', 'wrong-password'],
  ['auth/invalid-credential', 'wrong-password'],
  ['auth/too-many-requests', 'too-many-attempts'],
  ['auth/network-request-failed', 'offline'],
])('a %s sign-in error becomes %s and nothing is deleted', async (code, reason) => {
  jest.mocked(reauthenticateWithCredential).mockRejectedValueOnce({ code });
  await expect(deleteAccount('nope')).rejects.toEqual(new AccountDeletionError(reason as never));
  expect(mockCall).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
});

it('reports offline if the function can’t be reached', async () => {
  mockCall.mockRejectedValueOnce({ code: 'functions/unavailable' });
  await expect(deleteAccount('secret123')).rejects.toMatchObject({ reason: 'offline' });
  expect(signOut).not.toHaveBeenCalled();
});

it('reports a general failure for anything else', async () => {
  mockCall.mockRejectedValueOnce({ code: 'functions/internal' });
  await expect(deleteAccount('secret123')).rejects.toMatchObject({ reason: 'failed' });
});

it('fails safely with no signed-in user', async () => {
  mockAuth.currentUser = null;
  await expect(deleteAccount('secret123')).rejects.toMatchObject({ reason: 'failed' });
  expect(reauthenticateWithCredential).not.toHaveBeenCalled();
});
