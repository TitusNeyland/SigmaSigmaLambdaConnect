import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { createTestEnv, eventDoc, postDoc, seedBase, USERS } from './helpers';

let env: RulesTestEnvironment;

const as = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const anon = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedBase(env);
});

describe('chapter data is private to approved members', () => {
  const readable = [
    'members/alice',
    'roles/olivia',
    'events/open',
    'events/open/rsvps/x',
    'posts/alicePost',
    'posts/alicePost/comments/c1',
    'posts/alicePost/likes/alice',
    'programs/scholarship',
    'programs/scholarship/milestones/m1',
    'goals/g1',
    'announcements/a1',
  ];

  it.each(readable)('approved members can read %s', async (path) => {
    await assertSucceeds(getDoc(doc(as(USERS.alice), path)));
  });

  it.each(readable)('pending members cannot read %s', async (path) => {
    await assertFails(getDoc(doc(as(USERS.pete), path)));
  });

  it.each(readable)('declined members cannot read %s', async (path) => {
    await assertFails(getDoc(doc(as(USERS.dee), path)));
  });

  it.each(readable)('signed-in users without a profile cannot read %s', async (path) => {
    await assertFails(getDoc(doc(as(USERS.stranger), path)));
  });

  it.each(readable)('signed-out users cannot read %s', async (path) => {
    await assertFails(getDoc(doc(anon(), path)));
  });

  it('a roles doc does not help someone who is not approved', async () => {
    await assertFails(getDoc(doc(as(USERS.rogue), 'events/open')));
    await assertFails(getDoc(doc(as(USERS.rogue), 'reports/r1')));
  });

  it('denies collections that are not in the rules', async () => {
    await assertFails(getDoc(doc(as(USERS.adam), 'secrets/x')));
    await assertFails(setDoc(doc(as(USERS.adam), 'secrets/x'), { a: 1 }));
  });
});

describe('members', () => {
  const newProfile = (extra: object = {}) => ({
    displayName: 'New Brother',
    initiationTerm: 'Fall 2025',
    status: 'pending',
    createdAt: serverTimestamp(),
    ...extra,
  });

  it('people can read their own profile while pending', async () => {
    await assertSucceeds(getDoc(doc(as(USERS.pete), 'members/pete')));
  });

  it('a new user can create their own pending profile', async () => {
    await assertSucceeds(setDoc(doc(as(USERS.stranger), 'members/stranger'), newProfile()));
  });

  it('a new user cannot create a profile that is already approved', async () => {
    await assertFails(
      setDoc(doc(as(USERS.stranger), 'members/stranger'), newProfile({ status: 'approved' })),
    );
  });

  it("nobody can create someone else's profile", async () => {
    await assertFails(setDoc(doc(as(USERS.stranger), 'members/other'), newProfile()));
  });

  it('rejects unknown fields and fields set by officers', async () => {
    await assertFails(
      setDoc(doc(as(USERS.stranger), 'members/stranger'), newProfile({ reviewedBy: 'adam' })),
    );
    await assertFails(
      setDoc(doc(as(USERS.stranger), 'members/stranger'), newProfile({ isAdmin: true })),
    );
  });

  it('enforces the 150 character bio limit', async () => {
    await assertSucceeds(
      setDoc(doc(as(USERS.stranger), 'members/stranger'), newProfile({ bio: 'a'.repeat(150) })),
    );
    await env.clearFirestore();
    await assertFails(
      setDoc(doc(as(USERS.stranger), 'members/stranger'), newProfile({ bio: 'a'.repeat(151) })),
    );
  });

  it('requires a display name', async () => {
    await assertFails(
      setDoc(doc(as(USERS.stranger), 'members/stranger'), newProfile({ displayName: '' })),
    );
  });

  it('members can edit their own profile fields', async () => {
    await assertSucceeds(
      updateDoc(doc(as(USERS.alice), 'members/alice'), { bio: 'Mentoring chair', showPhone: true }),
    );
  });

  it('members cannot approve themselves', async () => {
    await assertFails(updateDoc(doc(as(USERS.pete), 'members/pete'), { status: 'approved' }));
  });

  it("members cannot edit someone else's profile", async () => {
    await assertFails(updateDoc(doc(as(USERS.alice), 'members/bob'), { bio: 'hacked' }));
  });

  it('officers can approve a pending member', async () => {
    await assertSucceeds(
      updateDoc(doc(as(USERS.olivia), 'members/pete'), {
        status: 'approved',
        reviewedBy: USERS.olivia,
        reviewedAt: serverTimestamp(),
      }),
    );
  });

  it('officers must record themselves as the reviewer', async () => {
    await assertFails(
      updateDoc(doc(as(USERS.olivia), 'members/pete'), {
        status: 'approved',
        reviewedBy: USERS.adam,
        reviewedAt: serverTimestamp(),
      }),
    );
  });

  it("officers cannot edit a member's profile while approving", async () => {
    await assertFails(
      updateDoc(doc(as(USERS.olivia), 'members/pete'), {
        status: 'approved',
        reviewedBy: USERS.olivia,
        reviewedAt: serverTimestamp(),
        bio: 'changed',
      }),
    );
  });

  it('regular members cannot approve anyone', async () => {
    await assertFails(
      updateDoc(doc(as(USERS.alice), 'members/pete'), {
        status: 'approved',
        reviewedBy: USERS.alice,
        reviewedAt: serverTimestamp(),
      }),
    );
  });

  it('members can delete their own account; others cannot', async () => {
    await assertFails(deleteDoc(doc(as(USERS.bob), 'members/alice')));
    await assertSucceeds(deleteDoc(doc(as(USERS.alice), 'members/alice')));
  });

  it('admins can delete a member; officers cannot', async () => {
    await assertFails(deleteDoc(doc(as(USERS.olivia), 'members/bob')));
    await assertSucceeds(deleteDoc(doc(as(USERS.adam), 'members/bob')));
  });
});

describe('roles', () => {
  it('only admins can make someone an officer', async () => {
    await assertFails(setDoc(doc(as(USERS.olivia), 'roles/alice'), { role: 'officer' }));
    await assertFails(setDoc(doc(as(USERS.alice), 'roles/alice'), { role: 'admin' }));
    await assertSucceeds(
      setDoc(doc(as(USERS.adam), 'roles/alice'), { role: 'officer', title: 'Treasurer' }),
    );
  });

  it('rejects roles that do not exist', async () => {
    await assertFails(setDoc(doc(as(USERS.adam), 'roles/alice'), { role: 'superuser' }));
  });

  it('pending users can see their own role but not change it', async () => {
    await assertSucceeds(getDoc(doc(as(USERS.rogue), 'roles/rogue')));
    await assertFails(updateDoc(doc(as(USERS.rogue), 'roles/rogue'), { title: 'King' }));
  });

  it('only admins can remove a role', async () => {
    await assertFails(deleteDoc(doc(as(USERS.olivia), 'roles/olivia')));
    await assertSucceeds(deleteDoc(doc(as(USERS.adam), 'roles/olivia')));
  });
});

describe('events', () => {
  const newEvent = () => ({ ...eventDoc(), createdAt: serverTimestamp() });

  it('officers can create events', async () => {
    await assertSucceeds(setDoc(doc(as(USERS.olivia), 'events/new'), newEvent()));
  });

  it('members cannot create events', async () => {
    await assertFails(
      setDoc(doc(as(USERS.alice), 'events/new'), { ...newEvent(), createdBy: USERS.alice }),
    );
  });

  it('rejects events with an unknown category', async () => {
    await assertFails(
      setDoc(doc(as(USERS.olivia), 'events/new'), { ...newEvent(), category: 'party' }),
    );
  });

  it('officers can edit and delete events; members cannot', async () => {
    await assertFails(updateDoc(doc(as(USERS.alice), 'events/open'), { title: 'Changed' }));
    await assertSucceeds(updateDoc(doc(as(USERS.olivia), 'events/open'), { title: 'Changed' }));
    await assertFails(deleteDoc(doc(as(USERS.alice), 'events/open')));
    await assertSucceeds(deleteDoc(doc(as(USERS.olivia), 'events/open')));
  });
});

describe('RSVPs', () => {
  const rsvp = (status: string) => ({ status, updatedAt: serverTimestamp() });

  it.each(['going', 'maybe', 'not_going'])('members can RSVP %s for themselves', async (s) => {
    await assertSucceeds(setDoc(doc(as(USERS.alice), 'events/open/rsvps/alice'), rsvp(s)));
  });

  it('rejects unknown RSVP values', async () => {
    await assertFails(setDoc(doc(as(USERS.alice), 'events/open/rsvps/alice'), rsvp('yes')));
  });

  it('members cannot RSVP for someone else', async () => {
    await assertFails(setDoc(doc(as(USERS.alice), 'events/open/rsvps/bob'), rsvp('going')));
  });

  it('RSVPs lock after the deadline', async () => {
    await assertFails(setDoc(doc(as(USERS.alice), 'events/closed/rsvps/alice'), rsvp('going')));
  });

  it('cannot RSVP to a cancelled event', async () => {
    await assertFails(setDoc(doc(as(USERS.alice), 'events/cancelled/rsvps/alice'), rsvp('going')));
  });

  it('cannot RSVP to an event that does not exist', async () => {
    await assertFails(setDoc(doc(as(USERS.alice), 'events/nope/rsvps/alice'), rsvp('going')));
  });

  it('pending members cannot RSVP', async () => {
    await assertFails(setDoc(doc(as(USERS.pete), 'events/open/rsvps/pete'), rsvp('going')));
  });

  it('members can change their RSVP before the deadline', async () => {
    await assertSucceeds(setDoc(doc(as(USERS.alice), 'events/open/rsvps/alice'), rsvp('going')));
    await assertSucceeds(setDoc(doc(as(USERS.alice), 'events/open/rsvps/alice'), rsvp('maybe')));
    await assertSucceeds(deleteDoc(doc(as(USERS.alice), 'events/open/rsvps/alice')));
  });
});

describe('attendance', () => {
  const checkIn = (by: string, extra: object = {}) => ({
    checkedInBy: by,
    checkedInAt: serverTimestamp(),
    ...extra,
  });

  it('officers can check members in with service hours', async () => {
    await assertSucceeds(
      setDoc(
        doc(as(USERS.olivia), 'events/open/attendance/pete'),
        checkIn(USERS.olivia, { serviceHours: 4, walkIn: true }),
      ),
    );
  });

  it('members cannot check themselves in', async () => {
    await assertFails(
      setDoc(doc(as(USERS.alice), 'events/open/attendance/alice'), checkIn(USERS.alice)),
    );
  });

  it('rejects impossible service hours', async () => {
    await assertFails(
      setDoc(
        doc(as(USERS.olivia), 'events/open/attendance/pete'),
        checkIn(USERS.olivia, { serviceHours: 25 }),
      ),
    );
    await assertFails(
      setDoc(
        doc(as(USERS.olivia), 'events/open/attendance/pete'),
        checkIn(USERS.olivia, { serviceHours: -1 }),
      ),
    );
  });

  it('members see only their own attendance', async () => {
    await assertSucceeds(getDoc(doc(as(USERS.alice), 'events/open/attendance/alice')));
    await assertFails(getDoc(doc(as(USERS.alice), 'events/open/attendance/bob')));
  });

  it('officers see everyone’s attendance', async () => {
    await assertSucceeds(getDocs(collection(as(USERS.olivia), 'events/open/attendance')));
  });
});

describe('posts', () => {
  const newPost = (authorId: string, extra: object = {}) => ({
    ...postDoc(authorId),
    createdAt: serverTimestamp(),
    ...extra,
  });

  it('members who accepted the guidelines can post', async () => {
    await assertSucceeds(setDoc(doc(as(USERS.alice), 'posts/new'), newPost(USERS.alice)));
  });

  it('members must accept the guidelines before posting', async () => {
    await assertFails(setDoc(doc(as(USERS.bob), 'posts/new'), newPost(USERS.bob)));
  });

  it('pending members cannot post', async () => {
    await assertFails(setDoc(doc(as(USERS.pete), 'posts/new'), newPost(USERS.pete)));
  });

  it('cannot post as someone else', async () => {
    await assertFails(setDoc(doc(as(USERS.alice), 'posts/new'), newPost(USERS.olivia)));
  });

  it('allows up to 10 photos', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => `posts/alice/new/${i}.jpg`);
    await assertSucceeds(
      setDoc(doc(as(USERS.alice), 'posts/new'), newPost(USERS.alice, { photoPaths: ten })),
    );
    await assertFails(
      setDoc(
        doc(as(USERS.alice), 'posts/new2'),
        newPost(USERS.alice, { photoPaths: [...ten, 'posts/alice/new/11.jpg'] }),
      ),
    );
  });

  it('a post needs a photo or a caption', async () => {
    await assertSucceeds(
      setDoc(doc(as(USERS.alice), 'posts/textOnly'), newPost(USERS.alice, { photoPaths: [] })),
    );
    await assertFails(
      setDoc(
        doc(as(USERS.alice), 'posts/empty'),
        newPost(USERS.alice, { photoPaths: [], caption: '' }),
      ),
    );
  });

  it('enforces the 2,200 character caption limit', async () => {
    await assertFails(
      setDoc(
        doc(as(USERS.alice), 'posts/long'),
        newPost(USERS.alice, { caption: 'a'.repeat(2201) }),
      ),
    );
  });

  it('new posts cannot start with likes, comments or removed', async () => {
    await assertFails(
      setDoc(doc(as(USERS.alice), 'posts/a'), newPost(USERS.alice, { likeCount: 99 })),
    );
    await assertFails(
      setDoc(doc(as(USERS.alice), 'posts/b'), newPost(USERS.alice, { commentCount: 5 })),
    );
    await assertFails(
      setDoc(doc(as(USERS.alice), 'posts/c'), newPost(USERS.alice, { removed: true })),
    );
  });

  it('only officers can make official chapter posts', async () => {
    await assertFails(
      setDoc(doc(as(USERS.alice), 'posts/official'), newPost(USERS.alice, { official: true })),
    );
    await assertSucceeds(
      setDoc(doc(as(USERS.olivia), 'posts/official'), newPost(USERS.olivia, { official: true })),
    );
  });

  it('authors can edit their caption but not counters', async () => {
    await assertSucceeds(updateDoc(doc(as(USERS.alice), 'posts/alicePost'), { caption: 'Edited' }));
    await assertFails(updateDoc(doc(as(USERS.alice), 'posts/alicePost'), { likeCount: 500 }));
  });

  it("members cannot edit someone else's post", async () => {
    await assertFails(updateDoc(doc(as(USERS.bob), 'posts/alicePost'), { caption: 'Mine now' }));
  });

  it('officers can remove a post, members cannot', async () => {
    await assertFails(updateDoc(doc(as(USERS.bob), 'posts/alicePost'), { removed: true }));
    await assertSucceeds(updateDoc(doc(as(USERS.olivia), 'posts/alicePost'), { removed: true }));
  });

  it('removed posts are hidden from other members', async () => {
    await assertFails(getDoc(doc(as(USERS.bob), 'posts/removedPost')));
    await assertSucceeds(getDoc(doc(as(USERS.alice), 'posts/removedPost')));
    await assertSucceeds(getDoc(doc(as(USERS.olivia), 'posts/removedPost')));
  });

  it('authors and officers can delete posts; others cannot', async () => {
    await assertFails(deleteDoc(doc(as(USERS.bob), 'posts/alicePost')));
    await assertSucceeds(deleteDoc(doc(as(USERS.alice), 'posts/alicePost')));
    await assertSucceeds(deleteDoc(doc(as(USERS.olivia), 'posts/noComments')));
  });
});

describe('comments', () => {
  const newComment = (authorId: string, text = 'Nice') => ({
    authorId,
    text,
    createdAt: serverTimestamp(),
  });

  it('members can comment as themselves', async () => {
    await assertSucceeds(
      setDoc(doc(as(USERS.bob), 'posts/alicePost/comments/new'), newComment(USERS.bob)),
    );
  });

  it('cannot comment as someone else', async () => {
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/alicePost/comments/new'), newComment(USERS.alice)),
    );
  });

  it('cannot comment when the author turned comments off', async () => {
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/noComments/comments/new'), newComment(USERS.bob)),
    );
  });

  it('cannot comment on a removed post', async () => {
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/removedPost/comments/new'), newComment(USERS.bob)),
    );
  });

  it('enforces the comment length limits', async () => {
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/alicePost/comments/a'), newComment(USERS.bob, '')),
    );
    await assertFails(
      setDoc(
        doc(as(USERS.bob), 'posts/alicePost/comments/b'),
        newComment(USERS.bob, 'a'.repeat(1001)),
      ),
    );
  });

  it('comments cannot be edited', async () => {
    await assertFails(
      updateDoc(doc(as(USERS.alice), 'posts/alicePost/comments/c1'), { text: 'Edited' }),
    );
  });

  it('authors and officers can delete comments; others cannot', async () => {
    await assertFails(deleteDoc(doc(as(USERS.bob), 'posts/alicePost/comments/c1')));
    await assertSucceeds(deleteDoc(doc(as(USERS.olivia), 'posts/alicePost/comments/c1')));
  });
});

describe('likes', () => {
  it('members can like and unlike as themselves', async () => {
    const ref = doc(as(USERS.bob), 'posts/alicePost/likes/bob');
    await assertSucceeds(setDoc(ref, { createdAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('cannot like as someone else or add extra fields', async () => {
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/alicePost/likes/olivia'), { createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/alicePost/likes/bob'), {
        createdAt: serverTimestamp(),
        weight: 100,
      }),
    );
  });

  it('cannot like a post that does not exist', async () => {
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/missing/likes/bob'), { createdAt: serverTimestamp() }),
    );
  });

  it("cannot remove someone else's like", async () => {
    await assertFails(deleteDoc(doc(as(USERS.bob), 'posts/alicePost/likes/alice')));
  });
});

describe('reports', () => {
  const newReport = (reporterId: string, extra: object = {}) => ({
    reporterId,
    targetType: 'post',
    postId: 'alicePost',
    targetAuthorId: USERS.alice,
    reason: 'harassment',
    status: 'open',
    createdAt: serverTimestamp(),
    ...extra,
  });

  it('members can report content', async () => {
    await assertSucceeds(setDoc(doc(as(USERS.bob), 'reports/new'), newReport(USERS.bob)));
  });

  it('cannot file a report as someone else', async () => {
    await assertFails(setDoc(doc(as(USERS.bob), 'reports/new'), newReport(USERS.alice)));
  });

  it('rejects unknown reasons and pre-resolved reports', async () => {
    await assertFails(
      setDoc(doc(as(USERS.bob), 'reports/a'), newReport(USERS.bob, { reason: 'boring' })),
    );
    await assertFails(
      setDoc(doc(as(USERS.bob), 'reports/b'), newReport(USERS.bob, { status: 'kept' })),
    );
  });

  it('pending members cannot file reports', async () => {
    await assertFails(setDoc(doc(as(USERS.pete), 'reports/new'), newReport(USERS.pete)));
  });

  it('reports are private to officers, even from the reporter', async () => {
    await assertFails(getDoc(doc(as(USERS.bob), 'reports/r1')));
    await assertFails(getDoc(doc(as(USERS.alice), 'reports/r1')));
    await assertSucceeds(getDoc(doc(as(USERS.olivia), 'reports/r1')));
  });

  it('officers resolve reports and are recorded as the resolver', async () => {
    await assertSucceeds(
      updateDoc(doc(as(USERS.olivia), 'reports/r1'), {
        status: 'removed',
        resolvedBy: USERS.olivia,
        resolvedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(USERS.olivia), 'reports/r1'), {
        status: 'kept',
        resolvedBy: USERS.adam,
        resolvedAt: serverTimestamp(),
      }),
    );
  });

  it('members cannot resolve reports', async () => {
    await assertFails(
      updateDoc(doc(as(USERS.bob), 'reports/r1'), {
        status: 'kept',
        resolvedBy: USERS.bob,
        resolvedAt: serverTimestamp(),
      }),
    );
  });
});

describe('blocks', () => {
  it('members manage only their own block list', async () => {
    await assertSucceeds(getDoc(doc(as(USERS.alice), 'blocks/alice/blocked/bob')));
    await assertFails(getDoc(doc(as(USERS.bob), 'blocks/alice/blocked/bob')));
    await assertSucceeds(
      setDoc(doc(as(USERS.bob), 'blocks/bob/blocked/alice'), { createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(as(USERS.bob), 'blocks/alice/blocked/olivia'), { createdAt: serverTimestamp() }),
    );
    await assertSucceeds(deleteDoc(doc(as(USERS.alice), 'blocks/alice/blocked/bob')));
  });

  it('cannot block yourself', async () => {
    await assertFails(
      setDoc(doc(as(USERS.bob), 'blocks/bob/blocked/bob'), { createdAt: serverTimestamp() }),
    );
  });
});

describe('officer-managed chapter content', () => {
  const paths = [
    'programs/new',
    'programs/scholarship/milestones/new',
    'goals/new',
    'announcements/new',
  ];

  it.each(paths)('officers can write %s', async (path) => {
    await assertSucceeds(setDoc(doc(as(USERS.olivia), path), { name: 'x' }));
  });

  it.each(paths)('members cannot write %s', async (path) => {
    await assertFails(setDoc(doc(as(USERS.alice), path), { name: 'x' }));
  });

  it('members cannot update milestones', async () => {
    await assertFails(
      updateDoc(doc(as(USERS.alice), 'programs/scholarship/milestones/m1'), { done: false }),
    );
  });
});

describe('KPIs', () => {
  it('officers can read computed KPIs; members cannot', async () => {
    await assertSucceeds(getDoc(doc(as(USERS.olivia), 'kpis/2026-fall')));
    await assertFails(getDoc(doc(as(USERS.alice), 'kpis/2026-fall')));
  });

  it('nobody can write KPIs from the app, not even admins', async () => {
    await assertFails(setDoc(doc(as(USERS.adam), 'kpis/2026-fall'), { participationRate: 1 }));
  });
});
