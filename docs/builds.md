# Builds and testing

Every pull request runs **CI** (`.github/workflows/ci.yml`): lint, typecheck, Prettier, the Functions build, unit tests and security rules tests. Test counts show as annotations on each check.

App builds use **EAS** (Expo Application Services) in the cloud, so no Mac build machine is needed.

## Profiles (`eas.json`)

| Profile              | What it's for                        | Firebase project | Install                                     |
| -------------------- | ------------------------------------ | ---------------- | ------------------------------------------- |
| `development`        | Day-to-day work in the iOS simulator | dev              | Simulator build, runs with `npm start`      |
| `development-device` | Day-to-day work on a real phone      | dev              | Install link from EAS                       |
| `preview`            | Beta testing with officers (#55)     | dev              | TestFlight and Google Play internal testing |
| `production`         | The App Store and Play Store         | prod             | Store release                               |

`preview` uses the dev project on purpose: beta testers can post and RSVP without touching real chapter data. Build numbers go up automatically.

## One-time setup

These need your accounts, so they can't be done from the repo.

1. **Expo account**: sign up at expo.dev, then on your machine run `npx eas-cli@latest login` and `npx eas-cli@latest init` in the repo. `init` adds the EAS project ID to `app.json`; commit that change.
2. **Apple Developer Program** ($99 a year). In App Store Connect, create the app with bundle ID `com.sigmasigmalambda.connect`. Put its numeric Apple ID in `eas.json` where it says `REPLACE_WITH_APP_STORE_CONNECT_APP_ID`. Run `npx eas-cli build -p ios --profile preview` once locally and let EAS create the certificates.
3. **Google Play Console** ($25 once). Create the app with package `com.sigmasigmalambda.connect`. Upload the first Android build by hand (Google requires it), then add a Play service account key in EAS so later builds submit automatically.
4. **GitHub secret**: create an access token at expo.dev > Account settings > Access tokens, and add it to the repo as `EXPO_TOKEN` under Settings > Secrets and variables > Actions.

## Making a build

- **From GitHub**: Actions > EAS build > Run workflow. Pick `preview` and leave "Send to TestFlight" on.
- **From your machine**: `npx eas-cli build --profile preview --platform all --auto-submit`

## Native code

Once a library with native code is added (push notifications in #25, for example), Expo Go stops being enough. Install a `development` or `development-device` build once, then keep using `npm start` as usual.
