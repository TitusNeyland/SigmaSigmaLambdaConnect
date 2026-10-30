import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';

import { membershipDecision } from './decisions';

describe('membershipDecision', () => {
  const at = Timestamp.fromMillis(1000);
  const decided = (status: string) => ({
    displayName: 'Sample Pete',
    status,
    reviewedBy: 'olivia',
    reviewedAt: at,
  });

  it('logs approvals and declines with who and when', () => {
    expect(membershipDecision('pete', { status: 'pending' }, decided('approved'))).toEqual({
      kind: 'membership',
      subjectId: 'pete',
      subjectName: 'Sample Pete',
      decision: 'approved',
      by: 'olivia',
      at,
    });
    expect(membershipDecision('pete', { status: 'pending' }, decided('declined'))?.decision).toBe(
      'declined',
    );
  });

  it('logs a later change of mind too', () => {
    expect(membershipDecision('pete', { status: 'declined' }, decided('approved'))?.decision).toBe(
      'approved',
    );
  });

  it('ignores profile edits and anything that is not a decision', () => {
    expect(
      membershipDecision('pete', decided('approved'), { ...decided('approved'), bio: 'x' }),
    ).toBeNull();
    expect(membershipDecision('pete', { status: 'approved' }, { status: 'pending' })).toBeNull();
    expect(membershipDecision('pete', undefined, undefined)).toBeNull();
  });
});
