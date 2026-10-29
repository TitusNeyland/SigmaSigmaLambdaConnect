# Sigma Sigma Lambda Connect

A private mobile app for the Sigma Sigma Lambda chapter of Alpha Phi Alpha Fraternity, Inc. It's a social app first (photo feed, comments, events) with chapter management built in (attendance, goals, KPIs, moderation) for officers.

Client project. Budget is lean, so keep scope tight: build what the issue asks for, nothing more.

## Where things are

- **Backlog:** GitHub issues, one milestone per phase. Work in milestone order: M0 Setup, M1 Members core, M2 Events, M3 Feed, M4 Chapter + Leadership, M5 Launch. "Later" is out of scope unless the issue is moved.
- **Epics:** each milestone has an "Epic:" issue with a checklist of its tickets.
- **Mockups:** the design canvas (private, ask Titus for access): https://claude.ai/artifact/HCycq4MqBnbSJsFLUwqacV. Each issue names its screen under "Mockup".
- **Screen map:** `docs/screens.md` describes every screen and maps it to issues.
- **Design brief:** `docs/design-brief.md`.
- **Backlog script:** `scripts/setup-backlog.sh` (already run, don't run again on this repo).

## Stack

- Expo SDK 58 + React Native + TypeScript (strict), Expo Router for navigation. Expo changes a lot between SDKs: follow `AGENTS.md` and check the versioned Expo docs instead of relying on memory.
- Add packages with `npx expo install <package>` so versions match the SDK.
- `npm run check` runs lint, typecheck and the Prettier check. Run it before every PR.
- Firebase: Auth (email and password), Firestore, Storage, Cloud Messaging, Cloud Functions (TypeScript)
- Two Firebase projects: dev and prod. No secrets in the repo.
- EAS for builds, GitHub Actions for lint, typecheck and tests
- Firebase emulator for local development and security rules tests

## Product rules

- **Private by default.** New accounts wait for officer approval before seeing any chapter data. Enforce this in Firestore security rules, not just the UI.
- **Roles:** member, officer (with a title like President or Treasurer), admin. Roles live server-side. Only admins change roles. Officers only see tools their role allows.
- **Leadership tools** live under the Chapter tab, never in the tab bar. Members never see them.
- **RSVP and attendance are separate.** RSVP is intent. Attendance is an officer check-in. Participation metrics use attendance, never RSVPs.
- **Metrics are computed** by Cloud Functions from real activity (check-ins, service hours, milestones), not typed in by hand.
- **Goals and KPIs are chapter-defined.** Never present a number as an official national requirement or score.
- **Sample data** is clearly fake. Don't use real member names.
- **Branding:** use "Sigma Sigma Lambda" and the ΣΣΛ monogram. Don't add the fraternity crest or other official marks until issue #52 confirms what national allows.

## App Store and Play must-haves

Anything labeled `app-store` blocks launch. Apple requires all of these for an app with user posts:

- Report a post or comment (#36)
- Block a user (#37)
- Accept community guidelines before posting (#38)
- Officers act on reports (#50)
- In-app account deletion (#16)
- A visible support contact (#15, #54)

If any social login is added later, Sign in with Apple must be added too.

## Design rules

Apple Human Interface Guidelines feel: clean, white, lots of space, system font, large bold titles, grouped lists, thin dividers, iOS segmented controls and switches. The feed should feel like Instagram. Author lines read like LinkedIn (role, initiation year, job).

Tokens:

| Token       | Value   | Use                                                      |
| ----------- | ------- | -------------------------------------------------------- |
| ink         | #111111 | Text, primary buttons, selected states                   |
| gold        | #C5A253 | Fills only: progress rings and bars, dots, badges, icons |
| goldText    | #8A6A1F | Any gold-colored text or links                           |
| goldSoft    | #F5EDD9 | Soft highlight backgrounds                               |
| bg          | #FFFFFF | Screen background                                        |
| grouped     | #F2F2F7 | Grouped list and settings backgrounds                    |
| secondary   | #6E6E73 | Secondary text                                           |
| separator   | #E5E5EA | Dividers                                                 |
| success     | #1F6B42 | On track                                                 |
| warning     | #9A4210 | Behind, at risk                                          |
| destructive | #B42318 | Delete, remove, block                                    |

- Never put #C5A253 text on a light background. It fails contrast.
- Meet WCAG AA contrast. Touch targets are at least 44 points.
- Define colors as tokens so dark mode (#62) can be added later.
- Tab bar: Home, Events, Post, Chapter, Profile. The active tab is filled and black. No oversized center button.

## How to work an issue

1. Read the issue, its acceptance criteria and its mockup screen in `docs/screens.md`.
2. Branch from `main` as `<issue-number>-short-name`, for example `9-sign-up`.
3. Build only what the criteria list. Note anything out of scope as a comment on the issue instead of building it.
4. Add tests for logic and security rules. Run lint, typecheck and tests before opening a PR.
5. Open a PR that says `Closes #<number>` and lists how to test it on a device.

## Conventions

- TypeScript strict mode. No `any` without a comment explaining why.
- Feature folders: `src/app/` for routes only (every file there is a screen), `src/features/<area>/` for screens, hooks and logic, `src/ui/` for shared components, `src/theme/` for tokens.
- Firestore access goes through typed helpers in `src/data/`, not inline in screens.
- Build screens from `src/ui` components and `src/theme` tokens. Never hardcode a color, font size or spacing value in a screen.
- Tests: `npm test` (Jest, app code, next to the file as `*.test.ts(x)`) and `npm run test:rules` (security rules on the emulators). Every PR adds tests for what it builds. CI runs both.
- Keep user-facing copy short and plain.
