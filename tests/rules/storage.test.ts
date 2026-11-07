import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { createTestEnv, seedBase, USERS } from './helpers';

let env: RulesTestEnvironment;

const as = (uid: string) => env.authenticatedContext(uid).storage() as unknown as FirebaseStorage;
const anon = () => env.unauthenticatedContext().storage() as unknown as FirebaseStorage;

const MB = 1024 * 1024;
const image = (bytes = 1024) => new Uint8Array(bytes);
const jpeg = { contentType: 'image/jpeg' };

async function put(path: string, bytes = 1024, meta = jpeg) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const storage = ctx.storage() as unknown as FirebaseStorage;
    await uploadBytes(ref(storage, path), image(bytes), meta);
  });
}

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seedBase(env);
  await put('avatars/alice/me.jpg');
  await put('posts/alice/p1/1.jpg');
  await put('events/open/hero.jpg');
});

describe('avatars', () => {
  it('people can upload their own photo, even while pending', async () => {
    await assertSucceeds(uploadBytes(ref(as(USERS.pete), 'avatars/pete/me.jpg'), image(), jpeg));
  });

  it("cannot upload someone else's photo", async () => {
    await assertFails(uploadBytes(ref(as(USERS.bob), 'avatars/alice/me.jpg'), image(), jpeg));
  });

  it('only images, up to 5 MB', async () => {
    await assertFails(
      uploadBytes(ref(as(USERS.alice), 'avatars/alice/me.pdf'), image(), {
        contentType: 'application/pdf',
      }),
    );
    await assertFails(
      uploadBytes(ref(as(USERS.alice), 'avatars/alice/big.jpg'), image(5 * MB + 1), jpeg),
    );
  });

  it('approved members can see avatars; pending and signed-out users cannot', async () => {
    await assertSucceeds(getBytes(ref(as(USERS.bob), 'avatars/alice/me.jpg')));
    await assertFails(getBytes(ref(as(USERS.pete), 'avatars/alice/me.jpg')));
    await assertFails(getBytes(ref(anon(), 'avatars/alice/me.jpg')));
  });

  it('people can delete only their own photo', async () => {
    await assertFails(deleteObject(ref(as(USERS.bob), 'avatars/alice/me.jpg')));
    await assertSucceeds(deleteObject(ref(as(USERS.alice), 'avatars/alice/me.jpg')));
  });
});

describe('post photos', () => {
  it('approved members upload under their own ID', async () => {
    await assertSucceeds(uploadBytes(ref(as(USERS.alice), 'posts/alice/p2/1.jpg'), image(), jpeg));
    await assertFails(uploadBytes(ref(as(USERS.alice), 'posts/bob/p2/1.jpg'), image(), jpeg));
  });

  it('pending members cannot upload post photos', async () => {
    await assertFails(uploadBytes(ref(as(USERS.pete), 'posts/pete/p1/1.jpg'), image(), jpeg));
  });

  it('only images, up to 10 MB', async () => {
    await assertSucceeds(
      uploadBytes(ref(as(USERS.alice), 'posts/alice/p3/1.jpg'), image(9 * MB), jpeg),
    );
    await assertFails(
      uploadBytes(ref(as(USERS.alice), 'posts/alice/p3/2.jpg'), image(10 * MB + 1), jpeg),
    );
    await assertFails(
      uploadBytes(ref(as(USERS.alice), 'posts/alice/p3/3.mp4'), image(), {
        contentType: 'video/mp4',
      }),
    );
  });

  it('only approved members can view post photos', async () => {
    await assertSucceeds(getBytes(ref(as(USERS.bob), 'posts/alice/p1/1.jpg')));
    await assertFails(getBytes(ref(as(USERS.pete), 'posts/alice/p1/1.jpg')));
    await assertFails(getBytes(ref(as(USERS.stranger), 'posts/alice/p1/1.jpg')));
  });

  it('authors and officers can delete post photos; others cannot', async () => {
    await assertFails(deleteObject(ref(as(USERS.bob), 'posts/alice/p1/1.jpg')));
    await assertSucceeds(deleteObject(ref(as(USERS.olivia), 'posts/alice/p1/1.jpg')));
  });
});

describe('comment photos', () => {
  it('approved members upload a photo named after themselves', async () => {
    await assertSucceeds(
      uploadBytes(ref(as(USERS.bob), 'comments/alicePost/bob-c1.jpg'), image(), jpeg),
    );
    await assertFails(
      uploadBytes(ref(as(USERS.bob), 'comments/alicePost/alice-c1.jpg'), image(), jpeg),
    );
  });

  it('pending members cannot upload comment photos', async () => {
    await assertFails(
      uploadBytes(ref(as(USERS.pete), 'comments/alicePost/pete-c1.jpg'), image(), jpeg),
    );
  });

  it('only images, up to 10 MB', async () => {
    await assertFails(
      uploadBytes(ref(as(USERS.bob), 'comments/p/bob-big.jpg'), image(10 * MB + 1), jpeg),
    );
    await assertFails(
      uploadBytes(ref(as(USERS.bob), 'comments/p/bob-c.mp4'), image(), {
        contentType: 'video/mp4',
      }),
    );
    await assertFails(
      uploadBytes(ref(as(USERS.bob), 'comments/p/bob-c.jpg'), image(), {
        contentType: 'application/octet-stream',
      }),
    );
  });

  it('authors and officers can delete comment photos; others cannot', async () => {
    await put('comments/alicePost/bob-c1.jpg');
    await assertFails(deleteObject(ref(as(USERS.alice), 'comments/alicePost/bob-c1.jpg')));
    await assertSucceeds(deleteObject(ref(as(USERS.olivia), 'comments/alicePost/bob-c1.jpg')));
  });

  it('approved members can view comment photos', async () => {
    await put('comments/alicePost/bob-c1.jpg');
    await assertSucceeds(getBytes(ref(as(USERS.alice), 'comments/alicePost/bob-c1.jpg')));
    await assertFails(getBytes(ref(as(USERS.pete), 'comments/alicePost/bob-c1.jpg')));
  });
});

describe('event photos', () => {
  it('officers upload photos to any event', async () => {
    await assertSucceeds(uploadBytes(ref(as(USERS.olivia), 'events/new/hero.jpg'), image(), jpeg));
    await assertSucceeds(uploadBytes(ref(as(USERS.olivia), 'events/open/2.jpg'), image(), jpeg));
  });

  it('members upload event photos named after themselves, and nothing else', async () => {
    // A new event's photo uploads before the event is saved (src/data/eventAdmin.ts).
    const mine = ref(as(USERS.alice), 'events/new/alice-1793888727089.jpg');
    await assertSucceeds(uploadBytes(mine, image(), jpeg));
    // Not someone else's file, and not the officer's existing photo.
    await assertFails(uploadBytes(ref(as(USERS.alice), 'events/new/bob-1.jpg'), image(), jpeg));
    await assertFails(uploadBytes(ref(as(USERS.alice), 'events/open/hero.jpg'), image(), jpeg));
    await assertFails(uploadBytes(ref(as(USERS.alice), 'events/new/hero.jpg'), image(), jpeg));
  });

  it('pending members cannot upload event photos', async () => {
    await assertFails(uploadBytes(ref(as(USERS.pete), 'events/new/hero.jpg'), image(), jpeg));
  });

  it('event photos are images up to 10 MB', async () => {
    await assertFails(
      uploadBytes(ref(as(USERS.alice), 'events/new/alice-big.jpg'), image(10 * MB + 1), jpeg),
    );
  });

  it('only officers delete event photos', async () => {
    await assertFails(deleteObject(ref(as(USERS.alice), 'events/open/hero.jpg')));
    await assertSucceeds(deleteObject(ref(as(USERS.olivia), 'events/open/hero.jpg')));
  });

  it('approved members can view event photos', async () => {
    await assertSucceeds(getBytes(ref(as(USERS.alice), 'events/open/hero.jpg')));
    await assertFails(getBytes(ref(as(USERS.pete), 'events/open/hero.jpg')));
  });
});

describe('committee report files', () => {
  const pdf = { contentType: 'application/pdf' };
  const docx = {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  const path = (uid: string, name = 'report.pdf') => `committeeReports/${uid}/r1/${name}`;

  it('approved members upload a PDF, Word file or photo under their own ID', async () => {
    const db = as(USERS.alice);
    await assertSucceeds(uploadBytes(ref(db, path('alice')), image(), pdf));
    await assertSucceeds(uploadBytes(ref(db, path('alice', 'report.docx')), image(), docx));
    await assertSucceeds(uploadBytes(ref(db, path('alice', 'photo.jpg')), image(), jpeg));
  });

  it('not under someone else’s ID, not while pending, not other types or over 10 MB', async () => {
    await assertFails(uploadBytes(ref(as(USERS.bob), path('alice')), image(), pdf));
    await assertFails(uploadBytes(ref(as(USERS.pete), path('pete')), image(), pdf));
    await assertFails(
      uploadBytes(ref(as(USERS.alice), path('alice', 'run.sh')), image(), {
        contentType: 'application/x-sh',
      }),
    );
    await assertFails(uploadBytes(ref(as(USERS.alice), path('alice')), image(10 * MB + 1), pdf));
  });

  it('the member and officers open it; other members can’t, and nobody replaces it', async () => {
    await put(path('alice'), 1024, pdf);
    await assertSucceeds(getBytes(ref(as(USERS.alice), path('alice'))));
    await assertSucceeds(getBytes(ref(as(USERS.olivia), path('alice'))));
    await assertFails(getBytes(ref(as(USERS.bob), path('alice'))));
    await assertFails(uploadBytes(ref(as(USERS.alice), path('alice')), image(), pdf));
    await assertFails(deleteObject(ref(as(USERS.alice), path('alice'))));
  });
});

describe('everything else', () => {
  it('is denied, even for admins', async () => {
    await assertFails(uploadBytes(ref(as(USERS.adam), 'random/file.jpg'), image(), jpeg));
    await assertFails(getBytes(ref(as(USERS.adam), 'events/open')));
  });
});
