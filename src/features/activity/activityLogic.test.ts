import { sampleActivity } from '@/data/__mocks__/activity';

import {
  activityAction,
  activitySections,
  activityTarget,
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
    eventId: null,
    announcementId: null,
    title: '',
    startsAt: null,
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

  const now = new Date(2026, 10, 5, 12);

  it('says what happened', () => {
    expect(activityAction(row({}), now)).toBe(' liked your post.');
    expect(activityAction(row({ type: 'comment', text: 'Nice' }), now)).toBe(' commented: Nice');
    expect(activityAction(row({ type: 'reply', text: 'Me' }), now)).toBe(
      ' replied to your comment: Me',
    );
    expect(activityAction(row({ type: 'comment' }), now)).toBe(' commented on your post.');
    expect(activityAction(row({ type: 'tag' }), now)).toBe(' tagged you in a post.');
  });

  it('words the chapter’s own notices as whole sentences', () => {
    const marcus = person('Sample Marcus');
    expect(
      activityAction(row({ type: 'announcement', actors: [marcus], title: 'Dues due' }), now),
    ).toBe(' posted an announcement: Dues due');
    const reminder = (startsAt: Date) =>
      activityAction(row({ type: 'event_reminder', title: 'Gala', startsAt }), now);
    expect(reminder(new Date(2026, 10, 6, 19))).toBe('Reminder: Gala is tomorrow at 7:00 PM.');
    expect(reminder(new Date(2026, 10, 5, 19))).toBe('Reminder: Gala is today at 7:00 PM.');
    expect(reminder(new Date(2026, 10, 7, 9))).toBe('Reminder: Gala is on Sat, Nov 7 at 9:00 AM.');
    expect(activityAction(row({ type: 'approved' }), now)).toMatch(/^Welcome to Sigma Sigma/);
  });

  it('knows where each one goes', () => {
    expect(activityTarget(row({ type: 'tag', postId: 'p2' }))).toEqual({
      pathname: '/home/post/[id]',
      params: { id: 'p2' },
    });
    expect(activityTarget(row({ type: 'reply' }))).toMatchObject({
      pathname: '/home/comments/[id]',
    });
    expect(activityTarget(row({ type: 'event_reminder', eventId: 'e1' }))).toEqual({
      pathname: '/events/[id]',
      params: { id: 'e1' },
    });
    expect(activityTarget(row({ type: 'announcement' }))).toEqual({ pathname: '/chapter' });
    expect(activityTarget(row({ type: 'approved' }))).toBeNull();
  });
});
