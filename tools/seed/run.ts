/**
 * Seeds sample data.
 *
 *   npm run seed:emulators            # into the local emulators (start them first)
 *   npm run seed:dev -- --yes         # into the real dev project
 *
 * Real projects need Application Default Credentials: `gcloud auth application-default login`.
 * Production is always refused.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { assertSafeTarget, buildSeedDocs, seedAuthUsers, writeSeed } from './seed';

const PROJECT_ALIASES: Record<string, string> = {
  dev: 'sigmasigmalambdadev',
  prod: 'sigmasigmalambdaproduction',
};

async function main() {
  const args = process.argv.slice(2);
  const projectArg = args[args.indexOf('--project') + 1];
  const requested =
    (args.includes('--project') ? projectArg : undefined) ?? process.env.GCLOUD_PROJECT;
  const projectId = requested ? (PROJECT_ALIASES[requested] ?? requested) : undefined;
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  const target = assertSafeTarget({ projectId, usingEmulator, confirmed: args.includes('--yes') });

  initializeApp({ projectId: target });
  const docs = buildSeedDocs();
  const written = await writeSeed(getFirestore(), docs);
  console.log(
    `Wrote ${written} sample documents to ${target}${usingEmulator ? ' (emulator)' : ''}.`,
  );

  if (!args.includes('--no-auth')) {
    const password = process.env.SEED_PASSWORD ?? (usingEmulator ? 'sample-password' : '');
    if (!password) {
      console.log('Skipped sign-in accounts. Set SEED_PASSWORD to create them in a real project.');
    } else {
      const users = await seedAuthUsers(getAuth(), password);
      console.log(`Created or updated ${users} sample sign-in accounts (@example.com).`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
