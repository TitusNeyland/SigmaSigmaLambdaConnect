import type { Auth } from 'firebase-admin/auth';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import {
  ANNOUNCEMENTS,
  CHAPTER_YEAR,
  EVENTS,
  GOALS,
  MEMBERS,
  POSTS,
  PROGRAMS,
  SAMPLE_EMAIL_DOMAIN,
} from './data';

export const PRODUCTION_PROJECT_ID = 'sigmasigmalambdaproduction';

export type SeedDoc = { path: string; data: Record<string, unknown> };

const DAY = 24 * 3600_000;

function at(now: Date, offsetMs: number): Timestamp {
  return Timestamp.fromMillis(now.getTime() + offsetMs);
}

function dayAt(now: Date, days: number, hour: number): Timestamp {
  const d = new Date(now.getTime() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return Timestamp.fromDate(d);
}

/** Every document the seed writes. Pure, so it can be tested without Firestore. */
export function buildSeedDocs(now: Date = new Date()): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const created = at(now, -30 * DAY);

  for (const member of MEMBERS) {
    docs.push({
      path: `members/${member.uid}`,
      data: {
        displayName: member.displayName,
        initiationTerm: member.initiationTerm,
        headline: member.headline,
        bio: member.bio,
        interests: member.interests,
        email: member.email,
        phone: member.phone,
        showEmail: true,
        showPhone: false,
        photoURL: null,
        status: member.status,
        guidelinesAcceptedAt: member.guidelinesAccepted ? created : null,
        createdAt: created,
        ...(member.status === 'approved'
          ? { reviewedBy: 'sample-andre', reviewedAt: at(now, -29 * DAY) }
          : {}),
      },
    });
    if (member.role) {
      docs.push({ path: `roles/${member.uid}`, data: { ...member.role } });
    }
  }

  for (const event of EVENTS) {
    const startsAt = dayAt(now, event.startsInDays, event.hour);
    docs.push({
      path: `events/${event.id}`,
      data: {
        title: event.title,
        category: event.category,
        description: event.description,
        location: event.location,
        startsAt,
        endsAt: Timestamp.fromMillis(startsAt.toMillis() + 3 * 3600_000),
        rsvpDeadline: Timestamp.fromMillis(
          startsAt.toMillis() - event.rsvpDeadlineDaysBefore * DAY,
        ),
        feeCents: event.feeCents ?? 0,
        photoURL: null,
        createdBy: 'sample-jordan',
        createdAt: created,
        cancelled: false,
      },
    });
    for (const [uid, status] of Object.entries(event.rsvps)) {
      docs.push({
        path: `events/${event.id}/rsvps/${uid}`,
        data: { memberId: uid, status, updatedAt: at(now, -2 * DAY) },
      });
    }
    for (const [uid, record] of Object.entries(event.attendance ?? {})) {
      docs.push({
        path: `events/${event.id}/attendance/${uid}`,
        data: {
          memberId: uid,
          checkedInBy: 'sample-jordan',
          checkedInAt: startsAt,
          walkIn: !(uid in event.rsvps),
          ...(record.serviceHours !== undefined ? { serviceHours: record.serviceHours } : {}),
        },
      });
    }
  }

  for (const post of POSTS) {
    const createdAt = at(now, -post.hoursAgo * 3600_000);
    docs.push({
      path: `posts/${post.id}`,
      data: {
        authorId: post.authorId,
        caption: post.caption,
        photoPaths: Array.from(
          { length: post.photoCount },
          (_, i) => `posts/${post.authorId}/${post.id}/${i + 1}.jpg`,
        ),
        eventId: post.eventId ?? null,
        taggedMemberIds: [],
        allowComments: post.allowComments ?? true,
        official: post.official ?? false,
        removed: false,
        likeCount: post.likes.length,
        commentCount: post.comments.length,
        createdAt,
      },
    });
    for (const uid of post.likes) {
      docs.push({ path: `posts/${post.id}/likes/${uid}`, data: { memberId: uid, createdAt } });
    }
    post.comments.forEach((comment, i) => {
      docs.push({
        path: `posts/${post.id}/comments/${comment.id}`,
        data: {
          authorId: comment.authorId,
          text: comment.text,
          createdAt: Timestamp.fromMillis(createdAt.toMillis() + (i + 1) * 600_000),
        },
      });
    });
  }

  for (const program of PROGRAMS) {
    docs.push({
      path: `programs/${program.id}`,
      data: {
        name: program.name,
        ownerTitle: program.ownerTitle,
        dueAt: dayAt(now, program.dueInDays, 17),
        status: program.status,
        chapterYear: CHAPTER_YEAR,
        createdAt: created,
      },
    });
    program.milestones.forEach(([name, done], i) => {
      docs.push({
        path: `programs/${program.id}/milestones/m${i + 1}`,
        data: {
          name,
          order: i + 1,
          done,
          doneAt: done ? created : null,
          doneBy: done ? 'sample-jordan' : null,
        },
      });
    });
  }

  for (const goal of GOALS) {
    const { id, ...rest } = goal;
    docs.push({ path: `goals/${id}`, data: { ...rest, chapterYear: CHAPTER_YEAR, done: false } });
  }

  ANNOUNCEMENTS.forEach((announcement, i) => {
    const { id, ...rest } = announcement;
    docs.push({
      path: `announcements/${id}`,
      data: { ...rest, createdAt: at(now, -(i + 1) * 3600_000) },
    });
  });

  return docs;
}

/** Refuses production and requires an explicit yes before touching a real project. */
export function assertSafeTarget(opts: {
  projectId: string | undefined;
  usingEmulator: boolean;
  confirmed: boolean;
}): string {
  const { projectId, usingEmulator, confirmed } = opts;
  if (!projectId) throw new Error('No project. Pass --project dev or set GCLOUD_PROJECT.');
  if (projectId === PRODUCTION_PROJECT_ID) {
    throw new Error('Refusing to seed the production project. Sample data never goes there.');
  }
  if (!usingEmulator && !confirmed) {
    throw new Error(`This writes sample data to the real ${projectId} project. Re-run with --yes.`);
  }
  return projectId;
}

/** Writes all seed docs. Safe to run again: IDs are fixed, so it overwrites. */
export async function writeSeed(db: Firestore, docs: SeedDoc[]): Promise<number> {
  const BATCH = 400;
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = db.batch();
    for (const { path, data } of docs.slice(i, i + BATCH)) batch.set(db.doc(path), data);
    await batch.commit();
  }
  return docs.length;
}

/** Creates or updates a sign-in account for each sample member. */
export async function seedAuthUsers(auth: Auth, password: string): Promise<number> {
  for (const member of MEMBERS) {
    if (!member.email.endsWith(`@${SAMPLE_EMAIL_DOMAIN}`)) {
      throw new Error(`Seed email must use ${SAMPLE_EMAIL_DOMAIN}: ${member.email}`);
    }
    const props = {
      email: member.email,
      password,
      displayName: member.displayName,
      emailVerified: true,
    };
    try {
      await auth.updateUser(member.uid, props);
    } catch {
      await auth.createUser({ uid: member.uid, ...props });
    }
  }
  return MEMBERS.length;
}
