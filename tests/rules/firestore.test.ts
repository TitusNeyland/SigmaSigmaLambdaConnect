import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  deleteField,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { createTestEnv, eventDoc, hoursFromNow, postDoc, seedBase, USERS } from './helpers';

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

  it('accepts the exact writes the app makes on sign up (src/data/auth.ts)', async () => {
    const db = as(USERS.stranger);
    const batch = writeBatch(db);
    batch.set(doc(db, 'members/stranger'), {
      displayName: 'Marcus Reed',
      initiationTerm: 'Spring 2019',
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'members/stranger/private/contact'), {
      email: 'marcus@example.com',
      phone: '',
      showEmail: false,
      showPhone: false,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it('accepts the profile written by Finish your profile, with no email (src/data/members.ts)', async () => {
    await assertSucceeds(
      setDoc(doc(as(USERS.stranger), 'members/stranger'), {
        displayName: 'Marcus Reed',
        initiationTerm: 'Spring 2019',
        status: 'pending',
        createdAt: serverTimestamp(),
      }),
    );
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
      updateDoc(doc(as(USERS.alice), 'members/alice'), {
        bio: 'Mentoring chair',
        phone: '555-0100',
      }),
    );
  });

  it('accepts the exact save from Edit profile (src/data/profile.ts)', async () => {
    const db = as(USERS.alice);
    const batch = writeBatch(db);
    batch.set(doc(db, 'members/alice/private/contact'), {
      email: 'alice@example.com',
      phone: '(555) 123-4567',
      showEmail: true,
      showPhone: false,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'members/alice'), {
      displayName: 'Alice Sample',
      initiationTerm: 'Spring 2020',
      headline: 'Engineer',
      bio: 'a'.repeat(150),
      interests: Array.from({ length: 10 }, (_, i) => `Interest ${i}`),
      email: 'alice@example.com',
      phone: deleteField(),
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  describe('private contact settings', () => {
    const contact = (extra: object = {}) => ({
      email: 'alice@example.com',
      phone: '555-0100',
      showEmail: false,
      showPhone: false,
      updatedAt: serverTimestamp(),
      ...extra,
    });
    const path = 'members/alice/private/contact';

    it('only the member can read them, not other brothers or officers', async () => {
      await assertSucceeds(setDoc(doc(as(USERS.alice), path), contact()));
      await assertSucceeds(getDoc(doc(as(USERS.alice), path)));
      for (const uid of [USERS.bob, USERS.olivia, USERS.adam, USERS.stranger]) {
        await assertFails(getDoc(doc(as(uid), path)));
      }
      await assertFails(getDocs(collection(as(USERS.olivia), 'members/alice/private')));
    });

    it('only the member can write them', async () => {
      await assertFails(setDoc(doc(as(USERS.adam), path), contact()));
      await assertSucceeds(setDoc(doc(as(USERS.pete), 'members/pete/private/contact'), contact()));
    });

    it('rejects other fields, other doc names and bad values', async () => {
      const db = as(USERS.alice);
      await assertFails(setDoc(doc(db, path), contact({ status: 'approved' })));
      await assertFails(setDoc(doc(db, 'members/alice/private/other'), contact()));
      await assertFails(setDoc(doc(db, path), contact({ showPhone: 'yes' })));
      await assertFails(setDoc(doc(db, path), contact({ phone: '5'.repeat(31) })));
      await assertFails(setDoc(doc(db, path), contact({ updatedAt: new Date(0) })));
    });

    it('members can no longer store show switches on the public doc', async () => {
      await assertFails(updateDoc(doc(as(USERS.alice), 'members/alice'), { showPhone: true }));
    });
  });

  it('members record guidelines acceptance with the real time only (#38)', async () => {
    const ref = doc(as(USERS.bob), 'members/bob');
    await assertFails(updateDoc(ref, { guidelinesAcceptedAt: new Date(0) }));
    await assertSucceeds(
      updateDoc(ref, { guidelinesAcceptedAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(ref, { guidelinesAcceptedAt: null }));
  });

  it('a member who has not accepted the guidelines cannot post until they do', async () => {
    const post = () =>
      setDoc(doc(as(USERS.bob), 'posts/firstPost'), {
        ...postDoc(USERS.bob),
        createdAt: serverTimestamp(),
      });
    await assertFails(post());
    await assertSucceeds(
      updateDoc(doc(as(USERS.bob), 'members/bob'), { guidelinesAcceptedAt: serverTimestamp() }),
    );
    await assertSucceeds(post());
  });

  it('members can save notification preferences one switch at a time (Settings)', async () => {
    await assertSucceeds(
      updateDoc(doc(as(USERS.alice), 'members/alice'), {
        'notificationPrefs.social': false,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as(USERS.alice), 'members/alice'), {
        notificationPrefs: { events: true, announcements: false, social: true, tasks: true },
      }),
    );
  });

  it('rejects unknown notification keys and non-boolean values', async () => {
    await assertFails(
      updateDoc(doc(as(USERS.alice), 'members/alice'), { 'notificationPrefs.marketing': true }),
    );
    await assertFails(
      updateDoc(doc(as(USERS.alice), 'members/alice'), { 'notificationPrefs.events': 'yes' }),
    );
    await assertFails(
      updateDoc(doc(as(USERS.alice), 'members/alice'), { notificationPrefs: 'all' }),
    );
  });

  it("members cannot change someone else's notification preferences", async () => {
    await assertFails(
      updateDoc(doc(as(USERS.alice), 'members/bob'), { 'notificationPrefs.events': false }),
    );
  });

  it('rejects more than 10 interests', async () => {
    await assertFails(
      updateDoc(doc(as(USERS.alice), 'members/alice'), {
        interests: Array.from({ length: 11 }, (_, i) => `Interest ${i}`),
      }),
    );
  });

  it('members can set or clear their own photo, not someone else’s', async () => {
    await assertSucceeds(
      updateDoc(doc(as(USERS.alice), 'members/alice'), {
        photoURL: 'https://cdn.test/a.jpg',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as(USERS.alice), 'members/alice'), {
        photoURL: null,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(USERS.alice), 'members/bob'), { photoURL: 'https://cdn.test/x.jpg' }),
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

  it('officers cannot promote themselves to admin or change their own title', async () => {
    await assertFails(setDoc(doc(as(USERS.olivia), 'roles/olivia'), { role: 'admin' }));
    await assertFails(updateDoc(doc(as(USERS.olivia), 'roles/olivia'), { title: 'President' }));
  });

  it('admins can change an officer’s title or make them an admin', async () => {
    await assertSucceeds(updateDoc(doc(as(USERS.adam), 'roles/olivia'), { title: 'President' }));
    await assertSucceeds(setDoc(doc(as(USERS.adam), 'roles/olivia'), { role: 'admin' }));
  });

  it('rejects extra fields and titles over 40 characters', async () => {
    await assertFails(
      setDoc(doc(as(USERS.adam), 'roles/alice'), { role: 'officer', canDelete: true }),
    );
    await assertFails(
      setDoc(doc(as(USERS.adam), 'roles/alice'), { role: 'officer', title: 'a'.repeat(41) }),
    );
  });

  it('approved members can see role badges; strangers cannot', async () => {
    await assertSucceeds(getDoc(doc(as(USERS.alice), 'roles/olivia')));
    await assertFails(getDoc(doc(as(USERS.stranger), 'roles/olivia')));
  });

  it('the directory reads (src/data/directory.ts) work for approved members only', async () => {
    const directoryReads = (db: Firestore) =>
      Promise.all([
        getDocs(query(collection(db, 'members'), where('status', '==', 'approved'))),
        getDocs(collection(db, 'roles')),
      ]);
    await assertSucceeds(directoryReads(as(USERS.alice)));
    for (const uid of [USERS.pete, USERS.dee, USERS.stranger, USERS.rogue]) {
      await assertFails(directoryReads(as(uid)));
    }
    await assertFails(directoryReads(anon()));
  });

  it('an officer loses officer access as soon as the role is removed', async () => {
    const newEvent = { ...eventDoc(), createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as(USERS.olivia), 'events/before'), newEvent));
    await assertSucceeds(deleteDoc(doc(as(USERS.adam), 'roles/olivia')));
    await assertFails(setDoc(doc(as(USERS.olivia), 'events/after'), newEvent));
  });
});

describe('events', () => {
  const newEvent = () => ({ ...eventDoc(), createdAt: serverTimestamp() });
  const eventWith = (extra: object) => ({ ...newEvent(), ...extra });

  it('the Events tab and calendar reads (src/data/events.ts) work for approved members only', async () => {
    const eventsTab = (db: Firestore, uid: string) =>
      Promise.all([
        getDocs(
          query(
            collection(db, 'events'),
            where('startsAt', '>=', new Date(Date.now() - 24 * 3600_000)),
            orderBy('startsAt', 'asc'),
            limit(100),
          ),
        ),
        // The calendar's month query (#21).
        getDocs(
          query(
            collection(db, 'events'),
            where('startsAt', '>=', new Date(2026, 9, 1)),
            where('startsAt', '<', new Date(2026, 10, 1)),
            orderBy('startsAt', 'asc'),
            limit(100),
          ),
        ),
        getDoc(doc(db, `events/open/rsvps/${uid}`)),
      ]);
    await assertSucceeds(eventsTab(as(USERS.alice), USERS.alice));
    for (const uid of [USERS.pete, USERS.dee, USERS.stranger]) {
      await assertFails(eventsTab(as(uid), uid));
    }
  });

  it('the event detail reads (src/data/events.ts) work for approved members only', async () => {
    const detail = (db: Firestore) => {
      const going = query(collection(db, 'events/open/rsvps'), where('status', '==', 'going'));
      return Promise.all([
        getDoc(doc(db, 'events/open')),
        getCountFromServer(going),
        getDocs(query(going, limit(5))),
        getDoc(doc(db, 'members/olivia')),
      ]);
    };
    await assertSucceeds(detail(as(USERS.alice)));
    for (const uid of [USERS.pete, USERS.dee, USERS.stranger]) {
      await assertFails(detail(as(uid)));
    }
  });

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

  it('accepts the exact event the officer form creates (src/data/eventAdmin.ts)', async () => {
    const start = new Date(Date.now() + 72 * 3600_000);
    await assertSucceeds(
      setDoc(doc(as(USERS.olivia), 'events/form'), {
        title: 'Scholarship gala',
        category: 'fundraiser',
        location: 'Hotel ballroom',
        address: '200 Sample Ave',
        description: 'Sample dinner.',
        startsAt: start,
        endsAt: new Date(start.getTime() + 3 * 3600_000),
        rsvpDeadline: new Date(start.getTime() - 24 * 3600_000),
        feeCents: 2500,
        photoURL: null,
        cancelled: false,
        createdBy: USERS.olivia,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('rejects an end before the start, a deadline after it, and a long address', async () => {
    const db = as(USERS.olivia);
    const start = hoursFromNow(72);
    const later = hoursFromNow(80);
    const earlier = hoursFromNow(60);
    await assertFails(
      setDoc(doc(db, 'events/a'), { ...newEvent(), startsAt: start, endsAt: earlier }),
    );
    await assertFails(
      setDoc(doc(db, 'events/b'), { ...newEvent(), startsAt: start, rsvpDeadline: later }),
    );
    await assertFails(setDoc(doc(db, 'events/c'), eventWith({ address: 'a'.repeat(201) })));
    await assertFails(updateDoc(doc(db, 'events/open'), { endsAt: hoursFromNow(1) }));
  });

  it('officers can cancel; who made it and when can never change', async () => {
    const db = as(USERS.olivia);
    await assertSucceeds(updateDoc(doc(db, 'events/open'), { cancelled: true }));
    await assertFails(updateDoc(doc(db, 'events/open'), { createdBy: USERS.adam }));
    await assertFails(updateDoc(doc(db, 'events/open'), { createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(USERS.alice), 'events/open'), { cancelled: true }));
  });
});

describe('RSVPs', () => {
  const rsvp = (status: string, memberId: string = USERS.alice) => ({
    memberId,
    status,
    updatedAt: serverTimestamp(),
  });

  it.each(['going', 'maybe', 'not_going'])('members can RSVP %s for themselves', async (s) => {
    await assertSucceeds(setDoc(doc(as(USERS.alice), 'events/open/rsvps/alice'), rsvp(s)));
  });

  it('rejects unknown RSVP values', async () => {
    await assertFails(setDoc(doc(as(USERS.alice), 'events/open/rsvps/alice'), rsvp('yes')));
  });

  it('members cannot RSVP for someone else', async () => {
    await assertFails(
      setDoc(doc(as(USERS.alice), 'events/open/rsvps/bob'), rsvp('going', USERS.bob)),
    );
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
    await assertFails(
      setDoc(doc(as(USERS.pete), 'events/open/rsvps/pete'), rsvp('going', USERS.pete)),
    );
  });

  it('requires memberId to match the person RSVPing', async () => {
    await assertFails(
      setDoc(doc(as(USERS.alice), 'events/open/rsvps/alice'), rsvp('going', USERS.bob)),
    );
    await assertFails(
      setDoc(doc(as(USERS.alice), 'events/open/rsvps/alice'), {
        status: 'going',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('members can change their RSVP before the deadline', async () => {
    await assertSucceeds(setDoc(doc(as(USERS.alice), 'events/open/rsvps/alice'), rsvp('going')));
    await assertSucceeds(setDoc(doc(as(USERS.alice), 'events/open/rsvps/alice'), rsvp('maybe')));
    await assertSucceeds(deleteDoc(doc(as(USERS.alice), 'events/open/rsvps/alice')));
  });
});

describe('attendance', () => {
  const checkIn = (by: string, memberId: string, extra: object = {}) => ({
    memberId,
    checkedInBy: by,
    checkedInAt: serverTimestamp(),
    ...extra,
  });

  it('officers can check members in with service hours', async () => {
    await assertSucceeds(
      setDoc(
        doc(as(USERS.olivia), 'events/open/attendance/pete'),
        checkIn(USERS.olivia, USERS.pete, { serviceHours: 4, walkIn: true }),
      ),
    );
  });

  it('members cannot check themselves in', async () => {
    await assertFails(
      setDoc(
        doc(as(USERS.alice), 'events/open/attendance/alice'),
        checkIn(USERS.alice, USERS.alice),
      ),
    );
  });

  it('rejects impossible service hours', async () => {
    await assertFails(
      setDoc(
        doc(as(USERS.olivia), 'events/open/attendance/pete'),
        checkIn(USERS.olivia, USERS.pete, { serviceHours: 25 }),
      ),
    );
    await assertFails(
      setDoc(
        doc(as(USERS.olivia), 'events/open/attendance/pete'),
        checkIn(USERS.olivia, USERS.pete, { serviceHours: -1 }),
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

  it('requires memberId to match the person checked in', async () => {
    await assertFails(
      setDoc(
        doc(as(USERS.olivia), 'events/open/attendance/pete'),
        checkIn(USERS.olivia, USERS.alice),
      ),
    );
    const { memberId: _omit, ...withoutMember } = checkIn(USERS.olivia, USERS.pete);
    await assertFails(setDoc(doc(as(USERS.olivia), 'events/open/attendance/pete'), withoutMember));
  });

  it('members can list their own attendance across events (profile Activity tab)', async () => {
    await assertSucceeds(
      getDocs(
        query(collectionGroup(as(USERS.alice), 'attendance'), where('memberId', '==', USERS.alice)),
      ),
    );
  });

  it('members cannot list someone else’s attendance across events', async () => {
    await assertFails(
      getDocs(
        query(collectionGroup(as(USERS.alice), 'attendance'), where('memberId', '==', USERS.bob)),
      ),
    );
    await assertFails(getDocs(collectionGroup(as(USERS.alice), 'attendance')));
  });

  it('pending members cannot list attendance, even their own', async () => {
    await assertFails(
      getDocs(
        query(collectionGroup(as(USERS.pete), 'attendance'), where('memberId', '==', USERS.pete)),
      ),
    );
  });

  it('officers can list everyone’s attendance across events', async () => {
    await assertSucceeds(getDocs(collectionGroup(as(USERS.olivia), 'attendance')));
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

  it('accepts the exact posts the compose screen shares (src/data/posts.ts)', async () => {
    const shared = (extra: object) => ({
      authorId: USERS.alice,
      caption: '',
      photoPaths: ['posts/alice/p/0.jpg', 'posts/alice/p/1.jpg'],
      eventId: null,
      taggedMemberIds: [],
      allowComments: true,
      official: false,
      removed: false,
      likeCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
      ...extra,
    });
    const db = as(USERS.alice);
    await assertSucceeds(setDoc(doc(db, 'posts/photos'), shared({})));
    await assertSucceeds(
      setDoc(
        doc(db, 'posts/textOnly'),
        shared({
          photoPaths: [],
          caption: 'Meeting moved',
          eventId: 'open',
          taggedMemberIds: ['bob'],
        }),
      ),
    );
    await assertFails(setDoc(doc(db, 'posts/empty'), shared({ photoPaths: [], caption: '' })));
    await assertFails(
      setDoc(doc(db, 'posts/tooMany'), shared({ taggedMemberIds: Array(21).fill('bob') })),
    );
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

  it('accepts the exact edit from the post menu (src/data/posts.ts)', async () => {
    await assertSucceeds(
      updateDoc(doc(as(USERS.alice), 'posts/alicePost'), {
        caption: 'Fixed',
        allowComments: false,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(USERS.alice), 'posts/alicePost'), { photoPaths: [], caption: 'x' }),
    );
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

  it('the feed query (src/data/feed.ts) works for approved members only', async () => {
    const feed = (db: Firestore) =>
      getDocs(
        query(
          collection(db, 'posts'),
          where('removed', '==', false),
          orderBy('createdAt', 'desc'),
          limit(10),
        ),
      );
    await assertSucceeds(feed(as(USERS.bob)));
    for (const uid of [USERS.pete, USERS.dee, USERS.stranger]) await assertFails(feed(as(uid)));
    // Without the removed filter, a member's query could include removed posts, so it's denied.
    await assertFails(
      getDocs(query(collection(as(USERS.bob), 'posts'), orderBy('createdAt', 'desc'), limit(10))),
    );
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

  it('members reply to a comment on the same post, not one that doesn’t exist (#34)', async () => {
    const db = as(USERS.bob);
    await assertSucceeds(
      setDoc(doc(db, 'posts/alicePost/comments/reply'), {
        ...newComment(USERS.bob),
        replyToId: 'c1',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'posts/alicePost/comments/bad'), {
        ...newComment(USERS.bob),
        replyToId: 'nope',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'posts/alicePost/comments/extra'), { ...newComment(USERS.bob), likeCount: 5 }),
    );
  });

  it('members like a comment as themselves only; the count is not theirs to set', async () => {
    const like = (uid: string) => ({ memberId: uid, createdAt: serverTimestamp() });
    const path = (uid: string) => `posts/alicePost/comments/c1/likes/${uid}`;
    await assertSucceeds(setDoc(doc(as(USERS.bob), path('bob')), like(USERS.bob)));
    await assertFails(setDoc(doc(as(USERS.bob), path('alice')), like(USERS.alice)));
    await assertFails(setDoc(doc(as(USERS.pete), path('pete')), like(USERS.pete)));
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/alicePost/comments/gone/likes/bob'), like(USERS.bob)),
    );
    await assertSucceeds(getDoc(doc(as(USERS.alice), path('bob'))));
    await assertFails(deleteDoc(doc(as(USERS.alice), path('bob'))));
    await assertSucceeds(deleteDoc(doc(as(USERS.bob), path('bob'))));
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
    await assertSucceeds(setDoc(ref, { memberId: USERS.bob, createdAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('cannot like as someone else or add extra fields', async () => {
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/alicePost/likes/olivia'), {
        memberId: USERS.olivia,
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/alicePost/likes/bob'), {
        memberId: USERS.bob,
        createdAt: serverTimestamp(),
        weight: 100,
      }),
    );
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/alicePost/likes/bob'), {
        memberId: USERS.alice,
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/alicePost/likes/bob'), { createdAt: serverTimestamp() }),
    );
  });

  it('cannot like a post that does not exist', async () => {
    await assertFails(
      setDoc(doc(as(USERS.bob), 'posts/missing/likes/bob'), {
        memberId: USERS.bob,
        createdAt: serverTimestamp(),
      }),
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

  it('accepts the exact member report from a profile (src/data/reports.ts)', async () => {
    await assertSucceeds(
      setDoc(doc(as(USERS.bob), 'reports/member'), {
        reporterId: USERS.bob,
        targetType: 'member',
        targetAuthorId: USERS.alice,
        reason: 'spam',
        status: 'open',
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('post and comment reports still need a post; nobody can report themselves', async () => {
    const { postId: _postId, ...noPost } = newReport(USERS.bob);
    await assertFails(setDoc(doc(as(USERS.bob), 'reports/a'), noPost));
    await assertFails(
      setDoc(
        doc(as(USERS.bob), 'reports/b'),
        newReport(USERS.bob, { targetType: 'member', targetAuthorId: USERS.bob }),
      ),
    );
    await assertFails(
      setDoc(doc(as(USERS.bob), 'reports/c'), newReport(USERS.bob, { targetType: 'event' })),
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

describe('push tokens', () => {
  const token = (extra: object = {}) => ({
    token: 'ExponentPushToken[abc]',
    platform: 'ios',
    updatedAt: serverTimestamp(),
    ...extra,
  });
  const path = (uid: string) => `pushTokens/${uid}/tokens/ExponentPushToken_abc_`;

  it('members save their own phone, including while pending (src/data/push.ts)', async () => {
    await assertSucceeds(setDoc(doc(as(USERS.alice), path('alice')), token()));
    await assertSucceeds(setDoc(doc(as(USERS.pete), path('pete')), token({ platform: 'android' })));
  });

  it('nobody else can read, write or remove them, not even officers', async () => {
    await assertSucceeds(setDoc(doc(as(USERS.alice), path('alice')), token()));
    for (const uid of [USERS.bob, USERS.olivia, USERS.adam]) {
      await assertFails(getDoc(doc(as(uid), path('alice'))));
      await assertFails(setDoc(doc(as(uid), path('alice')), token()));
      await assertFails(deleteDoc(doc(as(uid), path('alice'))));
    }
    await assertFails(getDocs(collection(as(USERS.olivia), 'pushTokens/alice/tokens')));
    await assertSucceeds(deleteDoc(doc(as(USERS.alice), path('alice'))));
  });

  it('rejects other fields, platforms and oversized tokens', async () => {
    const db = as(USERS.alice);
    await assertFails(setDoc(doc(db, path('alice')), token({ uid: 'bob' })));
    await assertFails(setDoc(doc(db, path('alice')), token({ platform: 'web' })));
    await assertFails(setDoc(doc(db, path('alice')), token({ token: 'x'.repeat(201) })));
    await assertFails(setDoc(doc(db, path('alice')), token({ updatedAt: new Date(0) })));
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

  it('members can list their own blocked accounts (Settings), not someone else’s', async () => {
    await assertSucceeds(getDocs(collection(as(USERS.alice), 'blocks/alice/blocked')));
    await assertFails(getDocs(collection(as(USERS.bob), 'blocks/alice/blocked')));
  });

  it('members cannot unblock on someone else’s behalf', async () => {
    await assertFails(deleteDoc(doc(as(USERS.bob), 'blocks/alice/blocked/bob')));
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
