# Push notifications

The app uses `expo-notifications` and Expo's push service. Expo delivers through Apple Push Notification service (APNs) on iPhone and Firebase Cloud Messaging (FCM) on Android, using credentials stored in EAS. Cloud Functions send by calling Expo's API with the tokens saved for each member.

## How it works

1. After sign in (pending or approved, never at first launch), the app asks for permission once and saves the phone's Expo push token to `pushTokens/{uid}/tokens/{tokenId}`. Only that member can read or change it.
2. Signing out removes this phone's token. Deleting the account removes all of them.
3. Functions call `sendPush(uids, kind, message)` in `functions/src/push.ts`. It checks each member's Settings switches (`notificationPrefs`) on the server, sends to every phone they have, and removes tokens for phones that deleted the app.
4. Kinds: `events`, `announcements`, `social` and `tasks` follow the Settings switches and only reach approved members. `account` (like "You're in" on approval) always sends.

Sent today: the approval notice (`notifyApproval`). Event reminders and new-event alerts come in #26.

## One-time setup (Titus)

1. **Link the EAS project:** run `npx eas init` in the repo. It writes `extra.eas.projectId` to `app.json`; commit that. Until it exists, the app skips push registration.
2. **iOS (APNs):** run `npx eas credentials`, choose iOS, then Push Notifications, and let EAS create an APNs key (it needs your Apple Developer login).
3. **Android (FCM):** in the Firebase console (each project), go to Project settings > Service accounts > Generate new private key. Then run `npx eas credentials`, choose Android, then FCM V1, and upload that JSON. Don't commit the key.
4. **New builds:** push needs a development build, not Expo Go. Rebuild with `eas build --profile development-device`.
5. **Deploy functions:** `npm --prefix functions run deploy:dev` (needs the Blaze plan).

## Testing on a phone

Sign up a test account on a real phone, allow notifications, then approve it from another officer account (or set `status: 'approved'` in the emulator UI). The phone should get "You're in" within a few seconds.
