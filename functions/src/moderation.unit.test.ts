import { describe, expect, it } from 'vitest';

import { reporterMessage, sameTarget, targetOf } from './moderation';

describe('targetOf', () => {
  it('reads posts, comments and members', () => {
    expect(targetOf({ targetType: 'post', postId: 'p', targetAuthorId: 'a' })).toEqual({
      targetType: 'post',
      postId: 'p',
      commentId: null,
      targetAuthorId: 'a',
    });
    expect(
      targetOf({ targetType: 'comment', postId: 'p', commentId: 'c', targetAuthorId: 'a' }),
    ).toMatchObject({ commentId: 'c' });
    expect(targetOf({ targetType: 'member', postId: 'ignored', targetAuthorId: 'a' })).toEqual({
      targetType: 'member',
      postId: null,
      commentId: null,
      targetAuthorId: 'a',
    });
  });

  it('rejects incomplete reports', () => {
    expect(targetOf({ targetType: 'post', targetAuthorId: 'a' })).toBeNull();
    expect(targetOf({ targetType: 'comment', postId: 'p', targetAuthorId: 'a' })).toBeNull();
    expect(targetOf({ targetType: 'post', postId: 'p' })).toBeNull();
    expect(targetOf({ targetType: 'event', postId: 'p', targetAuthorId: 'a' })).toBeNull();
  });
});

describe('sameTarget', () => {
  it('matches only the same thing by the same author', () => {
    const a = targetOf({ targetType: 'post', postId: 'p', targetAuthorId: 'a' })!;
    const b = targetOf({ targetType: 'post', postId: 'q', targetAuthorId: 'a' })!;
    expect(sameTarget(a, { ...a })).toBe(true);
    expect(sameTarget(a, b)).toBe(false);
  });
});

describe('reporterMessage', () => {
  const post = targetOf({ targetType: 'post', postId: 'p', targetAuthorId: 'a' })!;
  const member = targetOf({ targetType: 'member', targetAuthorId: 'a' })!;

  it('tells reporters the outcome without naming the officer', () => {
    expect(reporterMessage('removed', post).body).toBe(
      'Officers reviewed the post you reported and removed it.',
    );
    expect(reporterMessage('kept', post).body).toBe(
      'Officers reviewed the post you reported and decided it can stay.',
    );
    expect(reporterMessage('restricted', member).body).toBe(
      'Officers reviewed the member you reported and paused their posting for 7 days.',
    );
    expect(reporterMessage('kept', post).title).toBe('Thanks for your report');
  });
});
