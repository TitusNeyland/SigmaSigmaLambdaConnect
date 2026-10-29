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

describe('event photos', () => {
  it('officers upload event photos; members cannot', async () => {
    await assertSucceeds(uploadBytes(ref(as(USERS.olivia), 'events/new/hero.jpg'), image(), jpeg));
    await assertFails(uploadBytes(ref(as(USERS.alice), 'events/new/hero.jpg'), image(), jpeg));
  });

  it('approved members can view event photos', async () => {
    await assertSucceeds(getBytes(ref(as(USERS.alice), 'events/open/hero.jpg')));
    await assertFails(getBytes(ref(as(USERS.pete), 'events/open/hero.jpg')));
  });
});

describe('everything else', () => {
  it('is denied, even for admins', async () => {
    await assertFails(uploadBytes(ref(as(USERS.adam), 'random/file.jpg'), image(), jpeg));
    await assertFails(getBytes(ref(as(USERS.adam), 'events/open')));
  });
});
