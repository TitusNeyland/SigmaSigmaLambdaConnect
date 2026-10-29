/** Test double for src/data/account.ts. Use with `jest.mock('@/data/account')`. */
export type DeleteAccountError = 'wrong-password' | 'too-many-attempts' | 'offline' | 'failed';

export class AccountDeletionError extends Error {
  constructor(public readonly reason: DeleteAccountError) {
    super(reason);
    this.name = 'AccountDeletionError';
  }
}

export const deleteAccount = jest.fn(async (_password: string) => {});

export function resetAccountMock() {
  deleteAccount.mockReset().mockResolvedValue(undefined);
}
