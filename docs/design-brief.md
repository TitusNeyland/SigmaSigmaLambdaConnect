# Design Prompt: Chapter Platform for Alpha Phi Alpha Fraternity, Inc.

> [!important] Decisions made after this brief
> - The chapter is **Sigma Sigma Lambda**. The app uses the ΣΣΛ monogram.
> - The design moved to a cleaner Apple-style look and is **social first**: the photo feed is on Home and is part of the first build (milestone M3), not v2.
> - Officers get **mobile leadership tools** (Leadership home, attendance, reports). The desktop dashboard is in "Later".
> - Payments stay out of the first build.
> - The milestones in GitHub issues replace the v1, v2, v3 tags below. See `CLAUDE.md` and `docs/screens.md`.

Act as a senior product designer and mobile UI/UX lead. Design a premium, modern, private mobile app for a single chapter of Alpha Phi Alpha Fraternity, Inc.

It blends Instagram-quality social interaction, a modern event platform, and a friendly chapter performance dashboard. It should feel like a polished consumer app, not an ERP, a generic admin panel, or an old fraternity website.

**Goal:** strengthen brotherhood, raise participation, and help chapter leadership see how the chapter is doing at a glance.

> [!note] Phase tags
> Every feature is tagged **[v1]**, **[v2]**, or **[v3]**. Design v1 in full. Show v2 and v3 only as light placeholders so v1 does not imply scope the client has not bought yet.

---

## 1. Build order

| Phase | Scope |
|---|---|
| v1 | Accounts, membership approval, profiles, roles, events, RSVP, calendar, attendance, notifications, chapter goals and KPI dashboard |
| v2 | Social feed (photos, captions, likes, comments), reporting, moderation tools, member directory |
| v3 | In-app payments (dues, event fees, merchandise) and financial overview |

---

## 2. Visual identity

Apple-style minimalism, premium private-club feel, editorial typography, lots of whitespace, photography-first.

**Palette (tokens, not hardcoded values)**

| Token | Value | Use |
|---|---|---|
| Primary Black | #111111 | Text, primary buttons |
| Old Gold | #C5A253 | Fills, rings, icons, active states, indicators |
| Deep Gold | #8A6A1F | Any gold-colored text or small labels |
| Warm White | #FAF9F6 | App background |
| Card | #FFFFFF | Cards |
| Soft Gold | #F5EDD9 | Subtle highlights |
| Neutral Gray | #6B6B6B | Secondary text |
| Border | #EAE8E2 | Hairlines |

**Rules**

- Old Gold is for fills, progress rings, icons, and indicators only. Never use it for body or small text on light backgrounds because it fails contrast. Use Deep Gold or black for gold-toned text.
- Meet WCAG AA contrast everywhere.
- Gold is an accent. Use it sparingly.
- Light mode is the default. Define all colors as semantic tokens so dark mode (black and gold) can be added later. Dark mode is out of scope for v1, pending client decision.

**Type:** Inter or SF Pro for UI, plus a refined editorial serif for occasional large headings.

**Components:** cards, rounded buttons, avatars, image-first post cards, bottom sheets, status badges, calendars, progress rings and bars, RSVP controls, forms, loading and empty and error and success states.

**Branding:** use the chapter name and a simple tasteful monogram only. Do not use the crest, Greek letters, or official logos until the client confirms what the national organization permits. Treat any placeholder mark as a stand-in.

---

## 3. Roles and permissions

- **Guest / limited:** approved non-members (event guests, prospects). Can view and RSVP to events marked public. No feed, directory, or metrics. **[v1]**
- **Member:** profile, events, RSVP, calendar, notifications, own participation history, member-visible goals. Feed, comments, reporting **[v2]**. Payments **[v3]**.
- **Officer:** everything above plus create and manage events, record attendance, post announcements, manage programs, goals, and KPIs, manage membership approvals. Moderation queue **[v2]**. Financial summaries **[v3]**.
- **Admin:** officer permissions plus role assignment and chapter settings.

The member experience stays simple and social. Admin tools live under the Chapter tab, never in the bottom nav.

---

## 4. Navigation

Bottom nav for members: **Home, Events, Create, Chapter, Profile**.

- In v1, Home shows announcements and upcoming events. The feed arrives in v2.
- Create is centered and prominent.
- Chapter holds goals and progress, announcements, and (v2) the directory. Officers see a Management area here.
- Do not force every feature into the bottom bar.

---

## 5. Feature requirements

### Events and RSVP [v1] (primary focus)

- Event cards: image, name, date and time, location, short description, RSVP status, attendee count.
- Categories: chapter meeting, service, educational, brotherhood, fundraiser, public, social.
- Event details: hero image, description, time, location, RSVP, attendee info, fee if any.
- RSVP states: Going, Maybe, Not Going. Editable until the deadline.
- Calendar: month and agenda views, small gold dot on days with events, tap a day to see its events.
- **RSVP and actual attendance are tracked separately.** Officers record attendance. Participation metrics use attendance, not RSVPs.

### Chapter health and KPIs [v1] (primary focus)

- Dashboard with bento-grid layout: overall goal completion ring, program completion, participation rate, attendance rate, service progress, upcoming deadlines, goals at risk.
- Visuals: progress rings and bars, small trend lines, KPI cards, status chips, milestone timelines. No dense spreadsheets, no rainbow charts.
- All KPIs are **configurable by officers**. None are presented as official Alpha Phi Alpha requirements.
- KPI card: large value, label, small trend, progress to target, status.
- The headline percentage is a **chapter-defined metric** calculated from configured goals. Show how it is calculated. Any sample figure (for example 76%) is placeholder data only. Do not invent an official chapter score.
- Programs: name, description, owner, due date, status (Not Started, In Progress, At Risk, Completed), milestones, tasks, notes.
- Completion % = completed milestones divided by total applicable milestones, or explicit weights when configured.
- Optional Kanban board with the same four statuses.
- Example card: "Annual Scholarship Initiative, 75% complete, 3 of 4 milestones, next: Final Report, On Track."
- Participation analytics: eligible members, members attending at least one event, meeting attendance, service participation, trends. No public member rankings unless a chapter turns them on.

### Notifications [v1]

New events, event reminders, RSVP reminders, announcements, assigned tasks, approaching deadlines. Grouped screen with unread indicators and customizable preferences. Announcements appear as a pinned card with a subtle gold accent. Feed notifications (likes, comments) **[v2]**. Payment due dates **[v3]**.

### Accounts and onboarding [v1]

Welcome, sign up, sign in, email verification, password reset, **membership approval by an officer**, profile setup, edit profile, settings, notification preferences, account deletion, sign out. Private and invite-only by default.

### Profiles [v1]

Photo, name, chapter, optional line name or initiation year, bio, professional interests, participation highlights. Visibility follows member privacy settings and chapter rules.

### Social feed [v2]

- Photo posts (multiple images), captions, likes, comments, edit and delete for authors.
- Image-first layout, edge-to-edge or wide, minimal borders.
- Post creation with preview, upload progress, failure state, success state.
- **App Store requirements (required):** report content, block user, accept terms before posting, and a visible contact for abuse reports.
- Moderation queue for officers: review, dismiss, remove content, restrict member. Keep reporting discreet and low-friction.
- Stories and highlights are out of scope.

### Directory [v2]

Searchable member cards with optional filters, respecting privacy settings.

### Payments [v3]

- Not a wallet. No stored balances, no member-to-member transfers, no custody of funds.
- A regulated third-party provider (for example Stripe) processes payments and settles to the chapter's own merchant account.
- Screens: outstanding charges, amount and due date, status (Paid, Unpaid, Pending, Overdue, Refunded), secure checkout, receipts, personal history.
- Officer view: billed, collected, outstanding, collection rate, event revenue. Role-restricted.
- Provider setup and compliance need legal and tax review before launch.

---

## 6. Platforms

Mobile-first for iPhone and Android. Officers also get a responsive desktop or tablet experience, since the dashboard and program board will often be used on a laptop in meetings. Keep one consistent design system across both.

---

## 7. Interaction and content

- Working-feeling prototype interactions: RSVP, switch calendar views, open KPI details, filter analytics by period, update a milestone, switch admin views.
- Include loading, empty, error, success, and confirmation states.
- Realistic sample content: service days, scholarship presentations, chapter meetings, professional development events, member achievements. Natural photography, no generic corporate stock.
- **All names, events, and figures are illustrative, not real chapter records.**

---

## 8. Avoid

Generic AI dashboard looks, excessive gold, crowded screens, heavy borders, heavy gradients, too many competing buttons, dense enterprise UI, long forms, outdated fraternity styling.

---

## 9. Start here

Create five polished, high-fidelity screens to establish the visual identity and component system:

1. **Home** (announcements, upcoming events, v1 version)
2. **Events Discovery** with calendar toggle
3. **Event Details and RSVP**
4. **Chapter Health Dashboard** (desktop officer view)
5. **Annual Programs and KPI Tracking**

Hold the remaining screens (feed, profile, directory, payments, moderation, member management) until the system is approved.
