/** Test double for src/data/requests.ts. Use with `jest.mock('@/data/requests')`. */
import type { Decision, MembershipRequest } from '../requests';

let pending: MembershipRequest[] = [];
let failingLoad = false;
let failingDecide = false;

export function sampleRequest(overrides: Partial<MembershipRequest> = {}): MembershipRequest {
  return {
    uid: 'sample-jordan',
    displayName: 'Sample Jordan',
    initiationTerm: 'Spring 2024',
    photoURL: null,
    requestedAt: new Date(Date.now() - 2 * 86_400_000),
    ...overrides,
  };
}

export function failRequestsLoad() {
  failingLoad = true;
}

export function failNextDecision() {
  failingDecide = true;
}

export const fetchPendingRequests = jest.fn(async () => {
  if (failingLoad) {
    failingLoad = false;
    throw new Error('offline');
  }
  return pending;
});

export const decideRequest = jest.fn(async (uid: string, _officer: string, _d: Decision) => {
  if (failingDecide) {
    failingDecide = false;
    throw new Error('offline');
  }
  pending = pending.filter((r) => r.uid !== uid);
});

export function resetRequestsMock(initial: MembershipRequest[] = []) {
  pending = initial;
  failingLoad = false;
  failingDecide = false;
  fetchPendingRequests.mockClear();
  decideRequest.mockClear();
}
