# Store listing (#53)

Copy and assets for the App Store and Google Play. Text is a draft for the chapter to approve. Anything about the fraternity's name or marks waits on #52.

## Assets

| What                  | File                                    | Notes                                                                      |
| --------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| App icon              | `assets/images/icon.png`                | 1024×1024, opaque. Used for iOS and the App Store.                         |
| Android adaptive icon | `assets/images/android-icon-*.png`      | Gold mark on ink, inside the safe zone. Monochrome layer for themed icons. |
| Splash                | `assets/images/splash-icon.png`         | Gold mark on the ink background set in `app.json`.                         |
| Play feature graphic  | `assets/store/play-feature-graphic.png` | 1024×500.                                                                  |
| Play icon             | `assets/store/play-icon.png`            | 512×512.                                                                   |
| Screenshots           | Not made yet                            | Need a dev build with sample data. See below.                              |

All of these are drawn by `scripts/make-icons.py` from the ΣΣΛ monogram. Change the script and rerun it rather than editing the PNGs. No crest or other official marks are used.

## App Store

- **Name (30):** Sigma Sigma Lambda Connect
- **Subtitle (30):** Our chapter, in one place
- **Category:** Social Networking. Secondary: Lifestyle.
- **Keywords (100):** chapter,brotherhood,fraternity,alumni,events,RSVP,service hours,members,community,ΣΣΛ
- **Promotional text (170):** See what the brothers are up to, RSVP to chapter events and keep up with announcements. Private to approved members.

**Description**

Sigma Sigma Lambda Connect is the private app for members of the Sigma Sigma Lambda chapter.

- Share photos from chapter events and see what the brothers are posting
- Find upcoming events, RSVP and add them to your calendar
- Read chapter announcements and get reminders before events
- Look up brothers in the directory by name, job or interest
- See how the chapter's programs are going and offer to help

The app is private. New accounts wait for an officer to approve them before seeing anything.

Members can report posts and comments, block other members and reach the officers from Settings. Officers review every report.

**Support URL / Marketing URL:** the public support page from #54.
**Privacy policy URL:** from #54.

## Google Play

- **App name (30):** Sigma Sigma Lambda Connect
- **Short description (80):** The private app for the Sigma Sigma Lambda chapter: posts, events and news.
- **Full description:** same as the App Store description above.
- **Category:** Social.
- **Contact email:** the support address from #54.

## Screenshots

Take them from a dev build signed in as an officer, with clearly fake sample data (no real member names or photos).

1. Home feed with an official post and its event card
2. Events list, then the calendar
3. Event detail with the RSVP control
4. Chapter hub
5. Directory
6. Leadership home (officers)

App Store Connect asks for one iPhone size and scales the rest; use the size it lists as required when uploading. Play needs at least 2 phone screenshots.

## For review

Both stores need to get past the approval wall, so give reviewers a demo account in the review notes: an approved member who has accepted the guidelines, with sample posts and events in the project they'll use. Mention that new accounts need officer approval, and that reporting, blocking, account deletion and the support contact are in the app (Apple checks these for apps with user posts).
