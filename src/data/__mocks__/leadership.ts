/** Test double for src/data/leadership.ts. Use with `jest.mock('@/data/leadership')`. */
import type { WaitingCounts } from '../leadership';

let counts: WaitingCounts = { membershipRequests: 0, openReports: 0 };
let failing = false;

export function setMockWaiting(next: WaitingCounts) {
  counts = next;
}

export function failWaitingLoad() {
  failing = true;
}

export const fetchWaitingCounts = jest.fn(async () => {
  if (failing) {
    failing = false;
    throw new Error('offline');
  }
  return counts;
});

export function resetLeadershipMock() {
  counts = { membershipRequests: 0, openReports: 0 };
  failing = false;
  fetchWaitingCounts.mockClear();
}
