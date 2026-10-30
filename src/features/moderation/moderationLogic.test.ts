import { sampleCase } from '@/data/__mocks__/moderation';

import {
  actionsFor,
  authorLine,
  countLabel,
  doneLabel,
  kindLabel,
  reasonLabel,
} from './moderationLogic';

const member = sampleCase({ key: 'member_x', targetType: 'member', postId: null, preview: null });
const comment = sampleCase({ key: 'comment_p_c', targetType: 'comment', commentId: 'c' });

it('labels reasons with counts', () => {
  expect(reasonLabel({ reason: 'spam', count: 2 })).toBe('Spam ×2');
  expect(reasonLabel({ reason: 'harassment', count: 1 })).toBe('Harassment or bullying');
  expect(countLabel(1)).toBe('1 report');
  expect(countLabel(3)).toBe('3 reports');
});

it('describes what was reported and by whom', () => {
  expect([kindLabel(sampleCase()), authorLine(sampleCase())]).toEqual([
    'Post',
    'Posted by Sample Author',
  ]);
  expect(authorLine(comment)).toBe('Comment by Sample Author');
  expect(authorLine(member)).toBe('Sample Author was reported');
});

it('offers Remove only for content', () => {
  expect(actionsFor(sampleCase())).toEqual(['kept', 'removed', 'restricted']);
  expect(actionsFor(member)).toEqual(['kept', 'restricted']);
});

it('says what happened', () => {
  expect(doneLabel('kept', sampleCase(), 7)).toBe('Kept. Reporters were told.');
  expect(doneLabel('removed', comment, 7)).toBe('Comment removed. Reporters were told.');
  expect(doneLabel('restricted', member, 7)).toBe(
    'Sample Author can’t post or comment for 7 days. Reporters were told.',
  );
});
