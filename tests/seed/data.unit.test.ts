import { describe, expect, it } from 'vitest';

import { LIMITS } from '../../src/data/types';
import {
  ANNOUNCEMENTS,
  EVENTS,
  GOALS,
  MEMBERS,
  POSTS,
  PROGRAMS,
  SAMPLE_EMAIL_DOMAIN,
} from '../../tools/seed/data';
import { assertSafeTarget, buildSeedDocs, PRODUCTION_PROJECT_ID } from '../../tools/seed/seed';

const NOW = new Date('2026-10-29T12:00:00Z');
const memberIds = new Set(MEMBERS.map((m) => m.uid));
const approved = new Set(MEMBERS.filter((m) => m.status === 'approved').map((m) => m.uid));

describe('sample data is clearly fake', () => {
  it('every member ID starts with sample-', () => {
    for (const m of MEMBERS) expect(m.uid).toMatch(/^sample-/);
  });

  it('every email is on example.com', () => {
    for (const m of MEMBERS) expect(m.email.endsWith(`@${SAMPLE_EMAIL_DOMAIN}`)).toBe(true);
  });

  it('every phone number is in the fictional 555-01xx range', () => {
    for (const m of MEMBERS) expect(m.phone).toMatch(/^555-01\d\d$/);
  });

  it('event, post, program, goal and announcement IDs start with sample-', () => {
    const ids = [...EVENTS, ...POSTS, ...PROGRAMS, ...GOALS, ...ANNOUNCEMENTS].map((x) => x.id);
    for (const id of ids) expect(id).toMatch(/^sample-/);
  });

  it('posts, events and announcements say they are samples', () => {
    for (const p of POSTS) expect(p.caption).toMatch(/^Sample/);
    for (const e of EVENTS) expect(e.description).toMatch(/^Sample/);
    for (const a of ANNOUNCEMENTS) expect(a.body).toMatch(/^Sample/);
  });

  it('IDs and emails are unique', () => {
    expect(memberIds.size).toBe(MEMBERS.length);
    expect(new Set(MEMBERS.map((m) => m.email)).size).toBe(MEMBERS.length);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    expect(new Set(POSTS.map((p) => p.id)).size).toBe(POSTS.length);
  });
});

describe('sample data covers what the app needs to show', () => {
  it('has exactly one admin and several officers', () => {
    expect(MEMBERS.filter((m) => m.role?.role === 'admin')).toHaveLength(1);
    expect(MEMBERS.filter((m) => m.role?.role === 'officer').length).toBeGreaterThanOrEqual(3);
  });

  it('has pending members for the approval queue', () => {
    expect(MEMBERS.filter((m) => m.status === 'pending').length).toBeGreaterThanOrEqual(2);
  });

  it('only approved members hold roles', () => {
    for (const m of MEMBERS) if (m.role) expect(m.status).toBe('approved');
  });

  it('has past and upcoming events', () => {
    expect(EVENTS.some((e) => e.startsInDays < 0)).toBe(true);
    expect(EVENTS.some((e) => e.startsInDays > 0)).toBe(true);
  });

  it('has programs in every status', () => {
    const statuses = new Set(PROGRAMS.map((p) => p.status));
    expect([...statuses].sort()).toEqual(['at_risk', 'completed', 'in_progress', 'not_started']);
  });

  it('completed programs have every milestone done; not started ones have none', () => {
    for (const p of PROGRAMS) {
      if (p.status === 'completed') expect(p.milestones.every(([, done]) => done)).toBe(true);
      if (p.status === 'not_started') expect(p.milestones.some(([, done]) => done)).toBe(false);
    }
  });

  it('has an official chapter post and a post with comments', () => {
    expect(POSTS.some((p) => p.official)).toBe(true);
    expect(POSTS.some((p) => p.comments.length > 0)).toBe(true);
  });
});

describe('sample data is consistent', () => {
  it('posts, comments and likes reference approved members', () => {
    for (const p of POSTS) {
      expect(approved.has(p.authorId)).toBe(true);
      for (const uid of p.likes) expect(approved.has(uid)).toBe(true);
      for (const c of p.comments) expect(approved.has(c.authorId)).toBe(true);
    }
  });

  it('official posts come from officers', () => {
    for (const p of POSTS.filter((x) => x.official)) {
      expect(MEMBERS.find((m) => m.uid === p.authorId)?.role).toBeDefined();
    }
  });

  it('authors of posts accepted the guidelines', () => {
    for (const p of POSTS) {
      expect(MEMBERS.find((m) => m.uid === p.authorId)?.guidelinesAccepted).toBe(true);
    }
  });

  it('post events exist', () => {
    const eventIds = new Set(EVENTS.map((e) => e.id));
    for (const p of POSTS) if (p.eventId) expect(eventIds.has(p.eventId)).toBe(true);
  });

  it('RSVPs and attendance reference approved members', () => {
    for (const e of EVENTS) {
      for (const uid of Object.keys(e.rsvps)) expect(approved.has(uid)).toBe(true);
      for (const uid of Object.keys(e.attendance ?? {})) expect(approved.has(uid)).toBe(true);
    }
  });

  it('attendance is only recorded for events in the past', () => {
    for (const e of EVENTS) if (e.attendance) expect(e.startsInDays).toBeLessThan(0);
  });

  it('respects the app limits', () => {
    for (const m of MEMBERS) {
      expect(m.bio.length).toBeLessThanOrEqual(LIMITS.bio);
      expect(m.headline.length).toBeLessThanOrEqual(LIMITS.headline);
    }
    for (const p of POSTS) {
      expect(p.caption.length).toBeLessThanOrEqual(LIMITS.caption);
      expect(p.photoCount).toBeLessThanOrEqual(LIMITS.photosPerPost);
      for (const c of p.comments) expect(c.text.length).toBeLessThanOrEqual(LIMITS.comment);
    }
  });
});

describe('buildSeedDocs', () => {
  const docs = buildSeedDocs(NOW);
  const byPath = new Map(docs.map((d) => [d.path, d.data]));

  it('writes every path once', () => {
    expect(new Set(docs.map((d) => d.path)).size).toBe(docs.length);
  });

  it('writes a member doc for everyone and a role doc for each officer', () => {
    for (const m of MEMBERS) expect(byPath.has(`members/${m.uid}`)).toBe(true);
    expect(docs.filter((d) => d.path.startsWith('roles/'))).toHaveLength(
      MEMBERS.filter((m) => m.role).length,
    );
  });

  it('keeps contact details private, with only shown ones on the public doc', () => {
    for (const m of MEMBERS) {
      const contact = byPath.get(`members/${m.uid}/private/contact`)!;
      expect(contact).toMatchObject({ phone: m.phone, showPhone: false, showEmail: true });
      const pub = byPath.get(`members/${m.uid}`)!;
      expect(pub).not.toHaveProperty('phone');
      expect(pub).not.toHaveProperty('showPhone');
      expect(pub.email).toBe(m.email);
    }
  });

  it('only approved members get a reviewer', () => {
    for (const m of MEMBERS) {
      const data = byPath.get(`members/${m.uid}`)!;
      expect('reviewedBy' in data).toBe(m.status === 'approved');
    }
  });

  it('post counters match the seeded likes and comments', () => {
    for (const p of POSTS) {
      const data = byPath.get(`posts/${p.id}`)!;
      expect(data.likeCount).toBe(p.likes.length);
      expect(data.commentCount).toBe(p.comments.length);
      expect(data.photoPaths).toHaveLength(p.photoCount);
      expect(data.removed).toBe(false);
    }
  });

  it('photo paths match the storage rules layout', () => {
    for (const p of POSTS) {
      for (const path of byPath.get(`posts/${p.id}`)!.photoPaths as string[]) {
        expect(path).toMatch(new RegExp(`^posts/${p.authorId}/${p.id}/\\d+\\.jpg$`));
      }
    }
  });

  it('RSVP deadlines fall before each event starts', () => {
    for (const e of EVENTS) {
      const data = byPath.get(`events/${e.id}`)! as {
        startsAt: { toMillis(): number };
        rsvpDeadline: { toMillis(): number };
      };
      expect(data.rsvpDeadline.toMillis()).toBeLessThan(data.startsAt.toMillis());
    }
  });

  it('dates are relative to the seed date, so upcoming events stay upcoming', () => {
    const later = buildSeedDocs(new Date(NOW.getTime() + 30 * 24 * 3600_000));
    const a = byPath.get('events/sample-service-day') as { startsAt: { toMillis(): number } };
    const b = later.find((d) => d.path === 'events/sample-service-day')!.data as {
      startsAt: { toMillis(): number };
    };
    expect(b.startsAt.toMillis() - a.startsAt.toMillis()).toBe(30 * 24 * 3600_000);
  });

  it('RSVPs, attendance and likes carry memberId matching their document ID', () => {
    let checked = 0;
    for (const [path, data] of byPath) {
      const match = path.match(/\/(rsvps|attendance|likes)\/([^/]+)$/);
      if (!match) continue;
      expect(data.memberId).toBe(match[2]);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('marks attendees who did not RSVP as walk-ins', () => {
    expect(byPath.get('events/sample-meeting-past/attendance/sample-darius')?.walkIn).toBe(true);
    expect(byPath.get('events/sample-meeting-past/attendance/sample-marcus')?.walkIn).toBe(false);
  });
});

describe('assertSafeTarget', () => {
  it('always refuses production, even on the emulator and with --yes', () => {
    for (const usingEmulator of [true, false]) {
      expect(() =>
        assertSafeTarget({ projectId: PRODUCTION_PROJECT_ID, usingEmulator, confirmed: true }),
      ).toThrow(/production/);
    }
  });

  it('requires --yes for a real project', () => {
    expect(() =>
      assertSafeTarget({
        projectId: 'sigmasigmalambdadev',
        usingEmulator: false,
        confirmed: false,
      }),
    ).toThrow(/--yes/);
    expect(
      assertSafeTarget({ projectId: 'sigmasigmalambdadev', usingEmulator: false, confirmed: true }),
    ).toBe('sigmasigmalambdadev');
  });

  it('allows the emulator without --yes', () => {
    expect(assertSafeTarget({ projectId: 'demo-ssl', usingEmulator: true, confirmed: false })).toBe(
      'demo-ssl',
    );
  });

  it('needs a project', () => {
    expect(() =>
      assertSafeTarget({ projectId: undefined, usingEmulator: true, confirmed: true }),
    ).toThrow(/project/);
  });
});
