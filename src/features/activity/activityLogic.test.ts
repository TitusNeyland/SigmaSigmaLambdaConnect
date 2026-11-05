import { sampleActivity } from '@/data/__mocks__/activity';

import {
  activityAction,
  activitySections,
  actorNames,
  hasNewActivity,
  type ActivityRow,
} from './activityLogic';

const at = (h: number) => new Date(Date.UTC(2026, 10, 5, h));
const like = (actor: string, postId: string, h: number) =>
  sampleActivity({
    id: `like_${postId}_${actor}`,
    actorId: actor,
    actorName: `Sample ${actor}`,
    postId,
    at: at(h),
  });
const comment = (id: string, actor: string, h: number, text = 'Great night') =>
  sampleActivity({
    id: `comment_${id}`,
    type: 'comment',
    actorId: actor,
    actorName: `Sample ${actor}`,
    commentId: id,
    text,
    at: at(h),
  });
const none = new Set<string>();

describe('activitySections', () => {
  it('splits what came in since they last looked from what came before', () => {
    const items = [comment('c2', 'zed', 12), like('chris', 'p1', 10), comment('c1', 'zed', 8)];
    const sections = activitySections(items, at(9), none);
    expect(sections.map((s) => [s.title, s.rows.map((r) => r.key)])).toEqual([
      ['New', ['comment_c2', 'like_p1_chris']],
      ['Earlier', ['comment_c1']],
    ]);
    // Never looked: everything is new.
    expect(activitySections(items, null, none).map((s) => s.title)).toEqual(['New']);
  });

  it('groups likes on the same post, newest first, each person once', () => {
    const items = [
      like('chris', 'p1', 12),
      like('zed', 'p2', 11),
      like('ava', 'p1', 10),
      like('chris', 'p1', 9),
      like('ben', 'p1', 8),
    ];
    const [section] = activitySections(items, null, none);
    expect(section.rows.map((r) => [r.postId, r.actors.map((a) => a.id)])).toEqual([
      ['p1', ['chris', 'ava', 'ben']],
      ['p2', ['zed']],
    ]);
    expect(section.rows[0].at).toEqual(at(12));
  });

  it('leaves out people they blocked', () => {
    const items = [like('chris', 'p1', 12), comment('c1', 'zed', 11)];
    const sections = activitySections(items, null, new Set(['zed']));
    expect(sections[0].rows.map((r) => r.key)).toEqual(['like_p1_chris']);
    expect(activitySections(items, null, new Set(['zed', 'chris']))).toEqual([]);
  });
});

describe('hasNewActivity', () => {
  it('is true for anything after they last looked, from someone not blocked', () => {
    const items = [comment('c1', 'zed', 12), like('chris', 'p1', 8)];
    expect(hasNewActivity(items, at(10), none)).toBe(true);
    expect(hasNewActivity(items, at(13), none)).toBe(false);
    expect(hasNewActivity(items, at(10), new Set(['zed']))).toBe(false);
    expect(hasNewActivity(items, null, none)).toBe(true);
    expect(hasNewActivity([], null, none)).toBe(false);
  });
});

describe('wording', () => {
  const row = (o: Partial<ActivityRow>): ActivityRow => ({
    key: 'k',
    type: 'like',
    actors: [],
    postId: 'p1',
    text: '',
    photoPath: null,
    at: at(1),
    ...o,
  });
  const person = (name: string) => ({ id: name, name, photoURL: null });

  it('names one, two, or the first and how many others', () => {
    expect(actorNames([person('Sample Chris')])).toBe('Sample Chris');
    expect(actorNames([person('Sample Chris'), person('Sample Zed')])).toBe(
      'Sample Chris and Sample Zed',
    );
    expect(actorNames(['A', 'B', 'C'].map(person))).toBe('A and 2 others');
  });

  it('says what happened', () => {
    expect(activityAction(row({}))).toBe(' liked your post.');
    expect(activityAction(row({ type: 'comment', text: 'Nice' }))).toBe(' commented: Nice');
    expect(activityAction(row({ type: 'reply', text: 'Me' }))).toBe(' replied to your comment: Me');
    expect(activityAction(row({ type: 'comment' }))).toBe(' commented on your post.');
  });
});
