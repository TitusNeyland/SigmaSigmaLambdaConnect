/**
 * Test double for src/data/blocks.ts. Use with `jest.mock('@/data/blocks')`, then set the
 * blocked list with `setMockBlocked`.
 */
import type { BlockedAccount } from '../blocks';

let current: BlockedAccount[] = [];
let failing = false;
const listeners = new Set<(accounts: BlockedAccount[]) => void>();

export function setMockBlocked(accounts: BlockedAccount[]) {
  current = accounts;
  for (const l of listeners) l(accounts);
}

export function failBlockedLoad() {
  failing = true;
}

export const subscribeToBlocked = jest.fn(
  (
    _uid: string,
    onChange: (accounts: BlockedAccount[]) => void,
    onError: (error: unknown) => void,
  ) => {
    if (failing) {
      onError(new Error('offline'));
      return () => {};
    }
    listeners.add(onChange);
    onChange(current);
    return () => {
      listeners.delete(onChange);
    };
  },
);

export const unblock = jest.fn(async (_uid: string, otherUid: string) => {
  setMockBlocked(current.filter((a) => a.uid !== otherUid));
});

export const block = jest.fn(async (_uid: string, otherUid: string) => {
  setMockBlocked([{ uid: otherUid, displayName: otherUid, photoURL: null }, ...current]);
});

export function resetBlocksMock(initial: BlockedAccount[] = []) {
  current = initial;
  failing = false;
  listeners.clear();
  subscribeToBlocked.mockClear();
  unblock.mockClear();
  block.mockClear();
}
