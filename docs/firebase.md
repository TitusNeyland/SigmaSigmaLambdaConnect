# Firebase setup

The app uses two Firebase projects.

| Alias           | Project ID                   | Used for                          |
| --------------- | ---------------------------- | --------------------------------- |
| `dev` (default) | `sigmasigmalambdadev`        | Development, testing, sample data |
| `prod`          | `sigmasigmalambdaproduction` | The live app and real member data |

The app connects to Firebase with the JavaScript SDK. Each project has one **Web** app registered; its config lives in `src/config/env.ts`. That config only identifies the project and isn't secret. Security rules (`firestore.rules`, `storage.rules`) control who can read and write. Service account keys and other real secrets never go in the repo.

## Picking a project

| Command                   | Connects to                |
| ------------------------- | -------------------------- |
| `npm start`               | dev                        |
| `npm run start:prod`      | prod                       |
| `npm run start:emulators` | Local emulators (dev only) |

EAS build profiles (#6) set `EXPO_PUBLIC_APP_ENV=production` for store builds.

## Console checklist

Do this in **both** projects. Steps marked "later" can wait until the issue that needs them.

- [ ] **Web app registered** (done for both)
- [ ] **Authentication**: Build > Authentication > Get started > Sign-in method > enable **Email/Password**
- [ ] **Firestore**: Build > Firestore Database > Create database > **Production mode**, location `nam5 (United States)`. Production mode starts locked; the rules in this repo replace the defaults on deploy.
- [ ] **Storage**: Build > Storage > Get started > Production mode, same location
- [ ] **Blaze plan** (needed for Cloud Functions, push notifications and Storage on new projects). It's pay as you go, but at chapter scale it should stay within the free monthly allowance. Set a budget alert of $5 to $10 under Billing so nothing surprises you.
- [ ] **Cloud Messaging**: on by default. Push credentials go into EAS, not Firebase. See [notifications.md](notifications.md).
- [ ] Later: iOS and Android apps (only if we move to native Firebase SDKs)

Analytics was left out on purpose. Firebase's web Analytics SDK doesn't run in React Native.

## Cloud Functions

Code lives in `functions/` (TypeScript, Node 22).

```bash
npm --prefix functions install        # once
npm run functions:build               # compile to functions/lib
npm --prefix functions run deploy:dev # deploy to dev (needs Blaze)
```

`health` confirms deploys work. `deleteAccount` (#16) deletes a member's account and data when they ask from Settings. Functions tests run on the emulators with `npm run test:rules`.

After pulling changes that touch `firestore.indexes.json`, deploy the indexes too:

```bash
npx firebase deploy --only firestore:indexes --project dev
```

## Emulators

```bash
npx firebase login       # once
npm run emulators        # Auth 9099, Firestore 8080, Storage 9199, Functions 5001, UI 4000
npm run start:emulators  # in another terminal
```

The Firestore and Storage emulators need Java 11 or later installed. On an Android emulator, set `EXPO_PUBLIC_EMULATOR_HOST=10.0.2.2` so the app can reach your machine.

## Deploying rules

```bash
npx firebase deploy --only firestore:rules,storage --project dev
```

The rules in the repo are fully locked until #3 adds the real ones.

## Sample data

`tools/seed/` fills a project with made-up members, events, posts, programs, goals and announcements. Every ID starts with `sample-`, emails use example.com and phone numbers use 555-01xx. The seed always refuses the production project.

```bash
npm run emulators                        # terminal 1
npm run seed:emulators                   # terminal 2: seeds the emulators
npm run start:emulators                  # terminal 3: the app, using the emulators

gcloud auth application-default login    # once, for a real project
npm run seed:dev -- --yes                # seeds the real dev project
SEED_PASSWORD=... npm run seed:dev -- --yes   # also creates sample sign-in accounts
```

On the emulators, every sample account signs in with its `@example.com` email and the password `sample-password`. Useful ones: `sample-andre@example.com` (admin, President), `sample-jordan@example.com` (officer, Service Chair), `sample-marcus@example.com` (member), `sample-isaiah@example.com` (pending). Running the seed again overwrites the same documents.
