# App privacy answers (#54)

What to enter in App Store Connect (App Privacy) and the Google Play Console (Data safety). Based on what the app actually stores; see `docs/data-model.md` and the [privacy policy](../tools/site/pages/privacy.html). Re-check this whenever a feature starts collecting something new.

The app has no ads, no analytics or crash-reporting SDKs, no tracking and no selling of data. Everything below is used only to run the app, and all of it is linked to the member's account.

## Apple: App Privacy

**Do you or your third-party partners collect data from this app?** Yes.
**Tracking:** No data is used to track.

| Data type                         | Collected      | What it is                                                   | Purpose           | Linked to user |
| --------------------------------- | -------------- | ------------------------------------------------------------ | ----------------- | -------------- |
| Contact Info › Name               | Yes            | Display name                                                 | App Functionality | Yes            |
| Contact Info › Email Address      | Yes            | Sign-in email; optional email shown on profile               | App Functionality | Yes            |
| Contact Info › Phone Number       | Yes (optional) | Phone a member chooses to show                               | App Functionality | Yes            |
| User Content › Photos or Videos   | Yes            | Profile photo and post photos                                | App Functionality | Yes            |
| User Content › Other User Content | Yes            | Posts, captions, comments, profile bio, reports              | App Functionality | Yes            |
| Identifiers › User ID             | Yes            | Firebase account ID                                          | App Functionality | Yes            |
| Other Data                        | Yes            | RSVPs, event check-ins, service hours, notification settings | App Functionality | Yes            |

Not collected: location, contacts, health, financial info, browsing or search history, purchases, diagnostics, usage analytics.

Push tokens are stored so notifications reach the member's phone. If App Store Connect's guidance at the time asks for them, declare them under Identifiers › Device ID, App Functionality, linked.

## Google Play: Data safety

- **Does your app collect or share any of the required user data types?** Yes, collects. Nothing is shared with third parties (Firebase and Expo act as service providers, which Google doesn't count as sharing).
- **Is all of the user data encrypted in transit?** Yes (Firebase uses TLS).
- **Do you provide a way for users to request that their data is deleted?** Yes: in the app (Profile › Settings › Delete account) and by email. Account deletion URL: the support page (`SUPPORT_URL` in `src/config/app.ts`), which explains both.

| Category › Type                             | Collected | Optional | Purpose                                     |
| ------------------------------------------- | --------- | -------- | ------------------------------------------- |
| Personal info › Name                        | Yes       | No       | App functionality, Account management       |
| Personal info › Email address               | Yes       | No       | App functionality, Account management       |
| Personal info › Phone number                | Yes       | Yes      | App functionality                           |
| Personal info › User IDs                    | Yes       | No       | App functionality, Account management       |
| Photos and videos › Photos                  | Yes       | Yes      | App functionality                           |
| App activity › Other user-generated content | Yes       | Yes      | App functionality                           |
| App activity › Other actions                | Yes       | Yes      | App functionality (RSVPs, likes, check-ins) |

**Is data processed ephemerally?** No. It's stored until the member deletes it or their account.

## Other store questions

- **Sign-in required:** Yes. Give reviewers a demo account (see `docs/store-listing.md`).
- **User-generated content:** Yes, with reporting, blocking, guidelines that must be accepted before posting, and officer review.
- **Target audience (Play):** 18 and over.
