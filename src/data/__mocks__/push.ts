/**
 * Test double for src/data/push.ts. On for every test (jest.setup.js); data/push.test.ts
 * unmocks it.
 */
export const savePushToken = jest.fn(async (_uid: string, _token: string, _platform: string) => {});
export const removePushToken = jest.fn(async (_uid: string, _token: string) => {});
export const tokenDocId = (token: string) => token.replace(/[^A-Za-z0-9_-]/g, '_');

export function resetPushMock() {
  savePushToken.mockReset().mockResolvedValue(undefined);
  removePushToken.mockReset().mockResolvedValue(undefined);
}
