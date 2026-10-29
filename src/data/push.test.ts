import { deleteDoc, setDoc } from 'firebase/firestore';

import { removePushToken, savePushToken, tokenDocId } from './push';

jest.unmock('./push');
jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'NOW'),
}));

beforeEach(() => jest.clearAllMocks());

it('keys tokens by a Firestore-safe ID', () => {
  expect(tokenDocId('ExponentPushToken[ab/c+d]')).toBe('ExponentPushToken_ab_c_d_');
});

it('saves the token under the member with only the fields the rules allow', async () => {
  await savePushToken('me', 'ExponentPushToken[abc]', 'ios');
  expect(setDoc).toHaveBeenCalledWith(
    { path: 'pushTokens/me/tokens/ExponentPushToken_abc_' },
    { token: 'ExponentPushToken[abc]', platform: 'ios', updatedAt: 'NOW' },
  );
});

it('removes the token', async () => {
  await removePushToken('me', 'ExponentPushToken[abc]');
  expect(deleteDoc).toHaveBeenCalledWith({ path: 'pushTokens/me/tokens/ExponentPushToken_abc_' });
});
