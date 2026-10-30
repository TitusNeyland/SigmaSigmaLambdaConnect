import { describe, expect, it } from 'vitest';

import { commentMessage, likeDigestMessage, preview } from './social';

describe('messages', () => {
  it('trims long comments for the notification', () => {
    expect(preview('  Great   night  ')).toBe('Great night');
    const long = preview('word '.repeat(40));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('…')).toBe(true);
  });

  it('says who commented or replied, linking to the post', () => {
    expect(commentMessage('p1', 'Chris Baptiste', 'See you there', 'comment')).toEqual({
      title: 'Chris Baptiste commented on your post',
      body: 'See you there',
      data: { postId: 'p1' },
    });
    expect(commentMessage('p1', 'Chris Baptiste', 'Agreed', 'reply').title).toBe(
      'Chris Baptiste replied to your comment',
    );
  });

  it('batches likes into one line', () => {
    expect(likeDigestMessage(['Marcus Reed'], ['p1'])).toEqual({
      title: 'Marcus Reed liked your post',
      body: 'Tap to see it.',
      data: { postId: 'p1' },
    });
    expect(likeDigestMessage(['Marcus Reed', 'Chris Baptiste'], ['p1'])?.title).toBe(
      'Marcus Reed and 1 other liked your post',
    );
    expect(likeDigestMessage(['A', 'B', 'C'], ['p1', 'p2'])).toEqual({
      title: 'A and 2 others liked your posts',
      body: '2 of your posts got likes.',
      data: { screen: 'profile' },
    });
    expect(likeDigestMessage([], ['p1'])).toBeNull();
  });
});
