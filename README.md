# Sigma Sigma Lambda Connect

Private mobile app for the Sigma Sigma Lambda chapter: a photo feed, events and RSVPs, the brotherhood directory, and chapter progress, with leadership tools for officers.

Built with Expo SDK 58, React Native, TypeScript and Expo Router, on Firebase (Auth, Firestore, Storage, Cloud Functions). See `docs/firebase.md` for projects, console setup and emulators.

## Requirements

- Node.js 20 or later (22 recommended) and npm
- For iOS: a Mac with Xcode and an iOS simulator installed
- For Android: Android Studio with an emulator set up
- Or the Expo Go app on a physical phone

## Get started

```bash
git clone https://github.com/TitusNeyland/sigmasigmalambdaconnect
cd sigmasigmalambdaconnect
npm install
npm --prefix functions install
npm start
```

`npm start` opens the Expo dev server. From there:

| To run on        | Do this                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| iOS simulator    | Press `i`, or run `npm run ios`                                               |
| Android emulator | Start an emulator in Android Studio, then press `a`, or run `npm run android` |
| Your phone       | Scan the QR code with the Camera app (iOS) or Expo Go (Android)               |
| Web browser      | Press `w`, or run `npm run web`                                               |

Once a package with native code is added (Firebase, for example), Expo Go won't be enough and you'll need a development build: `npx expo run:ios`, `npx expo run:android`, or an EAS development build (#6).

## Scripts

| Script                                            | What it does                                                   |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `npm start`                                       | Start the Expo dev server                                      |
| `npm run ios` / `npm run android` / `npm run web` | Start and open on that platform                                |
| `npm run lint`                                    | ESLint with Expo's rules                                       |
| `npm run typecheck`                               | TypeScript check, no output files                              |
| `npm run format`                                  | Format everything with Prettier                                |
| `npm run format:check`                            | Fail if anything isn't formatted                               |
| `npm run check`                                   | Lint, typecheck and format check together. Run before every PR |

## Project layout

```
src/app/          Routes. Every file is a screen; _layout.tsx files define navigators
src/features/     Screens, hooks and logic grouped by area (added as features land)
src/ui/           Shared components (#4)
src/theme/        Design tokens (#4)
assets/           Icons, splash and images
docs/             Screen map and design brief
```

## Working on the backlog

Issues are grouped into milestones (M0 Setup through M5 Launch). See `CLAUDE.md` for product rules and how to work an issue, and `docs/screens.md` for what each screen does.
