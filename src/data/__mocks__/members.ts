/**
 * Test double for src/data/members.ts. Use with `jest.mock('@/data/members')`, then set the
 * signed-in member's profile with `setMockMember`.
 */
import type { MemberSummary } from '../members';

let current: MemberSummary | null | undefined;
const listeners = new Set<(member: MemberSummary | null) => void>();

export function setMockMember(member: MemberSummary | null) {
  current = member;
  for (const listener of listeners) listener(member);
}

export function sampleMember(overrides: Partial<MemberSummary> = {}): MemberSummary {
  return {
    displayName: 'Marcus Reed',
    initiationTerm: 'Spring 2019',
    status: 'approved',
    ...overrides,
  };
}

export const subscribeToOwnMember = jest.fn(
  (
    _uid: string,
    onChange: (member: MemberSummary | null) => void,
    _onError?: (error: unknown) => void,
  ) => {
    listeners.add(onChange);
    if (current !== undefined) onChange(current);
    return () => {
      listeners.delete(onChange);
    };
  },
);

const defaultSubscribe = subscribeToOwnMember.getMockImplementation()!;

export const createPendingProfile = jest.fn(async () => {});

export function resetMembersMock(initial: MemberSummary | null | undefined = sampleMember()) {
  current = initial;
  listeners.clear();
  subscribeToOwnMember.mockClear();
  subscribeToOwnMember.mockImplementation(defaultSubscribe);
  createPendingProfile.mockReset().mockResolvedValue(undefined);
}
