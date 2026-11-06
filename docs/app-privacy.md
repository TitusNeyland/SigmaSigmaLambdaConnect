# App privacy answers (#54)

What to enter in App Store Connect (App Privacy) and the Google Play Console (Data safety). It matches the [privacy policy](../tools/site/pages/privacy.html). If the app starts collecting something new, update both.

## Links for the store listings

| Field                              | Value                                                             |
| ---------------------------------- | ----------------------------------------------------------------- |
| Privacy policy URL                 | https://sigmasigmalambdaproduction.web.app/privacy                |
| Terms of use (EULA) URL            | https://sigmasigmalambdaproduction.web.app/terms                  |
| Support URL                        | https://sigmasigmalambdaproduction.web.app                        |
| Support email                      | `SUPPORT_EMAIL` in `src/config/app.ts`                            |
| Account deletion URL (Google Play) | https://sigmasigmalambdaproduction.web.app (Your account section) |

The site is built from `tools/site` and published with `firebase deploy --only hosting --project prod`.

## Apple: App Privacy

**Do you or your third-party partners collect data from this app?** Yes.

**Tracking:** No. The app doesn't track people across other companies' apps or websites, and has no ads or analytics.

Every type below is **linked to the user**, **not used for tracking**, and used only for **App Functionality**.

| Category     | Type               | What it is in the app                                                                                        |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Contact Info | Name               | Display name on the profile                                                                                  |
| Contact Info | Email Address      | Sign-in email; shown on the profile only if the member turns it on                                           |
| Contact Info | Phone Number       | Optional; shown only if the member turns it on                                                               |
| User Content | Photos or Videos   | Profile photo, post photos, photos attached to committee reports                                             |
| User Content | Other User Content | Posts, captions, comments, bio, committee reports and their files                                            |
| Identifiers  | User ID            | The member's account ID (also in their check-in QR code)                                                     |
| Location     | Coarse Location    | Optional city the member types on their profile (like Atlanta, GA). The app never reads the phone's location |
| Other Data   | Other Data Types   | Initiation term and date, RSVPs, event check-ins and service hours, reports and blocks                       |

Not collected: precise location (and no GPS or device location of any kind), health and fitness, financial info, sensitive info, contacts, browsing or search history, purchases, usage data or analytics, diagnostics or crash data, device ID for advertising.

Push tokens are stored so notifications reach the member's phone. If App Store Connect's guidance at the time asks for them, declare them under Identifiers › Device ID, App Functionality, linked.

## Google Play: Data safety

- **Does your app collect or share any of the required user data types?** Yes.
- **Is all of the user data collected by your app encrypted in transit?** Yes (Firebase and Resend use HTTPS).
- **Do you provide a way for users to request that their data is deleted?** Yes: Profile › Settings › Delete account in the app, or by emailing support.
- **Shared with third parties:** No. Firebase, Expo and Resend process data on the chapter's behalf, which Google doesn't count as sharing. Committee report emails go to the chapter's own officers.

| Data type                                  | Collected | Optional | Purpose                                                                                            |
| ------------------------------------------ | --------- | -------- | -------------------------------------------------------------------------------------------------- |
| Personal info: Name                        | Yes       | No       | App functionality, account management                                                              |
| Personal info: Email address               | Yes       | No       | App functionality, account management                                                              |
| Personal info: Phone number                | Yes       | Yes      | App functionality                                                                                  |
| Personal info: User IDs                    | Yes       | No       | App functionality, account management                                                              |
| Location: Approximate location             | Yes       | Yes      | App functionality (an optional city the member types; the app never reads the device's location)   |
| Personal info: Other info                  | Yes       | Yes      | App functionality (initiation term and date, headline, industry, businesses owned, interests, bio) |
| Photos and videos: Photos                  | Yes       | Yes      | App functionality                                                                                  |
| Files and docs                             | Yes       | Yes      | App functionality (committee report files)                                                         |
| App activity: Other user-generated content | Yes       | Yes      | App functionality (posts, comments, committee reports)                                             |
| App activity: Other actions                | Yes       | Yes      | App functionality (likes, RSVPs, check-ins, reports, blocks)                                       |

Not collected: precise location (and no device location at all), financial info, health and fitness, messages, audio, calendar, contacts, web browsing, app info and performance (no crash logs or diagnostics), device or other IDs for advertising.

**Is data processed ephemerally?** No. It's stored until the member deletes it or their account.

## Other store questions

- **Sign-in required:** Yes. Give reviewers a demo account (see `docs/store-listing.md`).
- **User-generated content:** Yes, with reporting, blocking, guidelines that must be accepted before posting, and officer review.
- **Target audience (Play):** 18 and over.

## Permissions the app asks for

| Permission    | Why                                                              |
| ------------- | ---------------------------------------------------------------- |
| Photos        | Choose a profile photo or photos for a post                      |
| Camera        | Take a photo for a post or profile; officers scan check-in codes |
| Calendar      | Add an event to the phone's calendar (write only)                |
| Notifications | Announcements, events, likes and comments, approvals             |
