#!/usr/bin/env bash
# Creates the Sigma Sigma Lambda Connect backlog: labels, milestones,
# ~55 tickets, one epic per milestone, and (optionally) a GitHub Project.
#
# Usage:
#   gh auth login                      # once, if you haven't
#   gh auth refresh -s project         # only needed for the Project board
#   bash setup-backlog.sh              # create everything
#   DRY_RUN=1 bash setup-backlog.sh    # print what it would do, create nothing
#
# Safe to re-run for labels and milestones. Re-running creates duplicate issues.

set -euo pipefail

REPO="${REPO:-TitusNeyland/sigmasigmalambdaconnect}"
OWNER="${REPO%%/*}"
PROJECT_TITLE="${PROJECT_TITLE:-Sigma Sigma Lambda Connect}"
CANVAS="https://claude.ai/artifact/HCycq4MqBnbSJsFLUwqacV"
DRY_RUN="${DRY_RUN:-0}"
URLS_FILE="$(mktemp)"
FAKE_N=0

say() { printf '%s\n' "$*" >&2; }

# ---------- low-level helpers ----------

make_label() { # name color description
  if [ "$DRY_RUN" = "1" ]; then say "label: $1"; return; fi
  gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null
}

make_milestone() { # title description
  if [ "$DRY_RUN" = "1" ]; then say "milestone: $1"; return; fi
  gh api "repos/$REPO/milestones" -f title="$1" -f description="$2" >/dev/null 2>&1 \
    || say "milestone exists, skipping: $1"
}

create_issue() { # title labels milestone body  -> prints issue number
  local url
  if [ "$DRY_RUN" = "1" ]; then
    FAKE_N=$(( $(wc -l < "$URLS_FILE") + 1 ))
    say "issue #$FAKE_N [$3] ($2): $1"
    url="https://github.com/$REPO/issues/$FAKE_N"
  else
    local ms_num args=() l
    ms_num="$(gh api "repos/$REPO/milestones?state=all&per_page=100" --jq ".[] | select(.title == \"$3\") | .number")"
    IFS=',' read -ra _labels <<< "$2"
    for l in "${_labels[@]}"; do args+=(-f "labels[]=$l"); done
    url="$(gh api "repos/$REPO/issues" -f title="$1" -f body="$4" -F milestone="$ms_num" "${args[@]}" --jq .html_url)" \
      || { say "FAILED: $1"; exit 1; }
    sleep 1
  fi
  echo "$url" >> "$URLS_FILE"
  echo "${url##*/}"
}

# ticket TITLE LABELS MILESTONE SCREEN STORY CRITERION...
ticket() {
  local title="$1" labels="$2" ms="$3" screen="$4" story="$5"
  shift 5
  local body="**Story:** $story"$'\n\n'"**Acceptance criteria**"$'\n'
  local c
  for c in "$@"; do body+="- [ ] $c"$'\n'; done
  body+=$'\n'"**Mockup:** $screen ([canvas]($CANVAS))"
  create_issue "$title" "feature,$labels" "$ms" "$body"
}

# chore TITLE LABELS MILESTONE STORY CRITERION...
chore() {
  local title="$1" labels="$2" ms="$3" story="$4"
  shift 4
  local body="**Goal:** $story"$'\n\n'"**Done when**"$'\n'
  local c
  for c in "$@"; do body+="- [ ] $c"$'\n'; done
  create_issue "$title" "chore,$labels" "$ms" "$body"
}

# epic TITLE MILESTONE SUMMARY CHILD_NUMBERS...
epic() {
  local title="$1" ms="$2" summary="$3"
  shift 3
  local body="$summary"$'\n\n'"**Tickets**"$'\n'
  local n
  for n in "$@"; do body+="- [ ] #$n"$'\n'; done
  create_issue "Epic: $title" "epic" "$ms" "$body" >/dev/null
}

# ---------- labels ----------
say "Creating labels..."
make_label epic      111111 "Groups the tickets for one milestone"
make_label feature   C5A253 "User-facing work"
make_label chore     B0B0B5 "Setup, process, non-feature work"
make_label app-store B42318 "Required for App Store or Play approval"
make_label infra     6E6E73 "Project setup, CI, builds"
make_label backend   3D3832 "Firestore, rules, Cloud Functions"
make_label design    E2DCCF "Design system and UI components"
make_label auth      8A6A1F "Accounts, sign in, approval"
make_label profile   A89B83 "Profile, edit profile, settings"
make_label directory CFC6B6 "Brotherhood directory"
make_label events    1F6B42 "Events, RSVP, calendar"
make_label feed      D9822B "Feed, posts, comments"
make_label moderation 9A4210 "Reports, blocking, guidelines"
make_label chapter   F5EDD9 "Chapter hub, announcements, progress"
make_label admin     2B2824 "Leadership tools for officers"
make_label notifications 5A5248 "Push notifications"

# ---------- milestones ----------
M0="M0 Setup"
M1="M1 Members core"
M2="M2 Events"
M3="M3 Feed"
M4="M4 Chapter + Leadership"
M5="M5 Launch"
ML="Later"
say "Creating milestones..."
make_milestone "$M0" "Project, Firebase, design system, navigation shell"
make_milestone "$M1" "Accounts, approval, profiles, settings, directory"
make_milestone "$M2" "Events, calendar, RSVP, reminders"
make_milestone "$M3" "Feed, posting, comments, moderation basics"
make_milestone "$M4" "Chapter hub, progress, mobile leadership tools"
make_milestone "$M5" "Store listing, policies, testing, submission"
make_milestone "$ML" "Not in the first release"

# ---------- M0 Setup ----------
say "Creating M0 tickets..."
k=()
k+=("$(chore "Initialize Expo app" "infra" "$M0" "Start the mobile app on a clean, typed foundation." \
  "Expo + React Native + TypeScript project with Expo Router" \
  "ESLint and Prettier configured, npm scripts for lint and typecheck" \
  "README explains how to run on iOS simulator and Android emulator")")
k+=("$(chore "Set up Firebase projects (dev and prod)" "infra,backend" "$M0" "Backend services ready in two environments." \
  "Firebase dev and prod projects with Auth, Firestore, Storage and Cloud Messaging enabled" \
  "App reads environment config without secrets in the repo" \
  "Cloud Functions project scaffolded with TypeScript")")
k+=("$(chore "Data model and security rules baseline" "backend" "$M0" "Define collections and lock them down before features land." \
  "Collections documented: members, roles, events, rsvps, attendance, posts, comments, likes, reports, blocks, programs, milestones, goals, announcements" \
  "Rules: only approved members read chapter data; officers-only writes where needed" \
  "Rules unit tests run in the Firebase emulator")")
k+=("$(ticket "Design tokens and core components" "design" "$M0" "All screens" "As a developer, I want shared tokens and components so every screen looks consistent." \
  "Tokens: black, old gold (fills only), deep gold for gold text, grays, radius, spacing, type scale" \
  "Components: buttons, list rows, grouped lists, segmented control, switch, bottom sheet, avatar, progress ring and bar" \
  "Text meets WCAG AA contrast")")
k+=("$(ticket "Tab bar navigation shell" "design" "$M0" "Home feed" "As a member, I want a simple tab bar so I can move between the main areas." \
  "Tabs: Home, Events, Post, Chapter, Profile with active state" \
  "Post tab opens the create flow as a modal" \
  "Each tab keeps its own navigation stack")")
k+=("$(chore "CI and EAS builds" "infra" "$M0" "Every PR is checked and testers can install builds." \
  "GitHub Actions runs lint, typecheck and tests on pull requests" \
  "EAS build profiles for development, preview and production" \
  "Preview builds go to TestFlight and Play internal testing")")
k+=("$(chore "Seed script with sample data" "backend" "$M0" "Realistic data for development and demos." \
  "Script seeds members, events, posts, programs and milestones into the dev project" \
  "All seeded names and figures are clearly fake")")
epic "Setup" "$M0" "Foundation work so feature tickets can start." "${k[@]}"

# ---------- M1 Members core ----------
say "Creating M1 tickets..."
k=()
k+=("$(ticket "Sign up and sign in" "auth" "$M1" "Onboarding" "As a brother, I want to create an account and sign in." \
  "Email and password sign up and sign in" \
  "Errors shown inline; loading state on submit" \
  "If any social login is added later, Sign in with Apple is added too")")
k+=("$(ticket "Email verification and password reset" "auth" "$M1" "Onboarding" "As a member, I want to verify my email and reset a forgotten password." \
  "Verification email sent on sign up; unverified users see a reminder screen" \
  "Forgot password flow sends a reset email")")
k+=("$(ticket "Membership request and officer approval gate" "auth,admin" "$M1" "Leadership home" "As an officer, I want to approve new accounts so the app stays private to the chapter." \
  "New accounts land on a pending screen until approved" \
  "Request captures name and initiation term" \
  "Approved members get a notification and full access; declined users see a message")")
k+=("$(ticket "Roles and permissions" "auth,backend" "$M1" "Leadership home" "As an admin, I want roles so officers only see the tools for their job." \
  "Roles: member, officer (with title), admin" \
  "Role stored server-side, enforced in security rules and checked in the UI" \
  "Only admins can change roles")")
k+=("$(ticket "My profile screen" "profile" "$M1" "Profile 1: My profile" "As a member, I want a profile that shows who I am and what I've done in the chapter." \
  "Photo, name, headline, initiation term, bio, interest tags, role badge" \
  "Counts for posts, events attended and service hours" \
  "Posts grid tab and Activity tab; attendance visible only to the member and officers")")
k+=("$(ticket "Edit profile" "profile" "$M1" "Profile 2: Edit profile" "As a member, I want to update my photo and details." \
  "Change photo with crop and upload" \
  "Edit name, headline, bio (150 characters with counter) and interests" \
  "Chapter role is read-only; show email and show phone switches")")
k+=("$(ticket "Settings screen" "profile" "$M1" "Profile 3: Settings" "As a member, I want to manage my account, notifications and privacy." \
  "Account section with email, password and membership status" \
  "Notification switches saved per member" \
  "Blocked accounts list, community guidelines, support contact, terms and privacy links" \
  "Sign out with confirmation")")
k+=("$(ticket "Account deletion" "profile,app-store" "$M1" "Profile 3: Settings" "As a member, I want to delete my account from inside the app." \
  "Delete account with a confirmation sheet" \
  "Profile, posts and comments removed; attendance records kept without the name" \
  "Meets Apple's in-app account deletion requirement")")
k+=("$(ticket "Brotherhood directory" "directory" "$M1" "Chapter 2: Brotherhood directory" "As a member, I want to find brothers by name, job or interest." \
  "A to Z list by last name with role badges" \
  "Live search across name, headline and interests" \
  "Filters: All, Officers, Mentors, recent initiates; empty state")")
k+=("$(ticket "View another member's profile" "directory,profile" "$M1" "Profile 1: My profile" "As a member, I want to open a brother's profile from the directory or a post." \
  "Same layout as My profile without edit controls" \
  "Contact details follow that member's privacy settings" \
  "Block and report options in the menu")")
epic "Members core" "$M1" "Accounts, approval, profiles, settings and the directory." "${k[@]}"

# ---------- M2 Events ----------
say "Creating M2 tickets..."
k=()
k+=("$(ticket "Events list" "events" "$M2" "Events + Calendar" "As a member, I want to browse upcoming events." \
  "Featured next event, then rows with date, time, place and my RSVP state" \
  "Category chips and search" \
  "Empty state when a category has no events")")
k+=("$(ticket "Calendar view" "events" "$M2" "Events + Calendar" "As a member, I want a month calendar so I can plan ahead." \
  "Segmented control switches Upcoming and Calendar" \
  "Gold dots on days with events; tapping a day lists its events" \
  "Previous and next month")")
k+=("$(ticket "Event detail" "events" "$M2" "Event Details + RSVP" "As a member, I want the full details of an event." \
  "Hero photo, category, title, host" \
  "Date, place, fee and RSVP deadline rows" \
  "Who's going summary and about text")")
k+=("$(ticket "RSVP going, maybe, can't go" "events" "$M2" "Event Details + RSVP" "As a member, I want to RSVP in one tap and change it before the deadline." \
  "Segmented RSVP control with confirmation text" \
  "Changes locked after the RSVP deadline" \
  "RSVP is stored separately from attendance")")
k+=("$(ticket "Add to calendar and directions" "events" "$M2" "Event Details + RSVP" "As a member, I want the event in my phone calendar and a way to get there." \
  "Add creates a device calendar event" \
  "Directions opens Apple Maps or Google Maps")")
k+=("$(chore "Push notification setup" "notifications,infra" "$M2" "Members can receive push notifications." \
  "APNs and FCM configured; device tokens saved per member" \
  "Permission prompt shown after sign in, not at first launch" \
  "Notification preferences from Settings respected server-side")")
k+=("$(ticket "Event reminders and new event alerts" "events,notifications,backend" "$M2" "Events + Calendar" "As a member, I want a reminder before events I'm going to." \
  "Scheduled Cloud Function sends reminders to Going and Maybe RSVPs" \
  "New event notification to all members" \
  "RSVP deadline nudge for members who haven't answered")")
k+=("$(ticket "Create and edit event (officers)" "events,admin" "$M2" "Leadership home" "As an officer, I want to create an event from my phone." \
  "Title, category, photo, date and time, place, fee, RSVP deadline, description" \
  "Edit and cancel; cancel notifies RSVPs" \
  "Only officers can create events")")
epic "Events" "$M2" "Events, calendar, RSVP and reminders." "${k[@]}"

# ---------- M3 Feed ----------
say "Creating M3 tickets..."
k=()
k+=("$(ticket "Home feed" "feed" "$M3" "Home feed" "As a member, I want a feed of chapter posts." \
  "Upcoming events strip at the top" \
  "Paginated posts, newest first, pull to refresh" \
  "Hidden content from blocked users and removed posts")")
k+=("$(ticket "Likes on posts" "feed" "$M3" "Home feed" "As a member, I want to like a post." \
  "Like and unlike with instant feedback" \
  "Accurate like count")")
k+=("$(ticket "Pick photos for a new post" "feed" "$M3" "Post 1: Pick photos" "As a member, I want to pick up to 10 photos for a post." \
  "Grid picker with numbered multi-select and preview" \
  "Camera and text-only options" \
  "Next disabled until something is picked")")
k+=("$(ticket "Compose and share a post" "feed" "$M3" "Post 2: Caption + share" "As a member, I want to add a caption and share my post." \
  "Caption, cover photo, tag event, tag brothers, allow comments switch" \
  "Visible to approved chapter members only" \
  "Posted confirmation with links to the feed and the post")")
k+=("$(ticket "Image upload with progress and retry" "feed,backend" "$M3" "Post 2: Caption + share" "As a member, I want uploads to work on a weak connection." \
  "Images resized and compressed before upload" \
  "Progress shown; failed uploads can be retried without losing the caption" \
  "Storage rules limit file size and type")")
k+=("$(ticket "Post detail and comments" "feed" "$M3" "Post 3: Comments, report, block" "As a member, I want to read and add comments." \
  "Comment list with like per comment and reply" \
  "Comment input with Post button disabled when empty" \
  "Comment count updates")")
k+=("$(ticket "Edit and delete my posts and comments" "feed" "$M3" "Post 3: Comments, report, block" "As a member, I want to fix or remove something I posted." \
  "Edit caption and delete post with confirmation" \
  "Delete own comments")")
k+=("$(ticket "Report a post or comment" "moderation,app-store" "$M3" "Post 3: Comments, report, block" "As a member, I want to report content that breaks the rules." \
  "Reasons: spam, harassment or bullying, inappropriate, something else" \
  "Reporter stays anonymous; reported content hidden for the reporter" \
  "Report lands in the officers' queue")")
k+=("$(ticket "Block a user" "moderation,app-store" "$M3" "Post 3: Comments, report, block" "As a member, I want to block someone." \
  "Confirmation sheet; blocked user is not notified" \
  "Blocked user's posts and comments hidden; unblock from Settings")")
k+=("$(ticket "Community guidelines acceptance" "moderation,app-store" "$M3" "Post 2: Caption + share" "As the chapter, we want members to accept the guidelines before posting." \
  "Guidelines shown and accepted before a member's first post" \
  "Acceptance timestamp stored" \
  "Guidelines link in Settings and on the compose screen")")
k+=("$(ticket "Official chapter posts" "feed,chapter" "$M3" "Home feed" "As an officer, I want official posts to stand out." \
  "Officers can post as Sigma Sigma Lambda with a gold verified badge" \
  "Official posts can attach an event card with an RSVP button")")
k+=("$(ticket "Like and comment notifications" "feed,notifications" "$M3" "Home feed" "As a member, I want to know when someone engages with my post." \
  "Notifications for likes (batched) and comments" \
  "Respects the Likes and comments setting")")
epic "Feed" "$M3" "The photo feed, posting flow, comments and required moderation basics." "${k[@]}"

# ---------- M4 Chapter + Leadership ----------
say "Creating M4 tickets..."
k=()
k+=("$(ticket "Chapter hub" "chapter" "$M4" "Chapter 1: Chapter hub" "As a member, I want one place for chapter info." \
  "Progress card, shortcut tiles (Directory, Programs, Calendar, Documents)" \
  "Officers row; Leadership card at the top for officers only, with a waiting count")")
k+=("$(ticket "Announcements" "chapter,notifications" "$M4" "Chapter 1: Chapter hub" "As an officer, I want to post announcements members won't miss." \
  "Officers create announcements; members get a push" \
  "Unread dots; tapping expands and marks read")")
k+=("$(ticket "Programs, milestones and goals data" "chapter,backend" "$M4" "Annual Programs + KPIs (officer, desktop)" "As an officer, I want programs tracked by milestones." \
  "Program: name, owner, due date, status, milestones" \
  "Percent complete = finished milestones divided by total" \
  "Officers can check off milestones from mobile")")
k+=("$(ticket "Member progress view and I can help" "chapter" "$M4" "Chapter 3: Chapter progress" "As a member, I want to see how the chapter is doing and help where needed." \
  "Programs grouped: needs help, on track, completed; tap to expand milestones" \
  "I can help notifies the program owner")")
k+=("$(ticket "Leadership home with KPIs" "admin" "$M4" "Leadership 1: Leadership home" "As an officer, I want the chapter's health at a glance on my phone." \
  "Goals ring and KPI tiles: participation, attendance, service hours, active members" \
  "Period filter: semester, chapter year, 30 days" \
  "Needs attention list and quick actions; officers only")")
k+=("$(chore "KPI calculations" "backend,admin" "$M4" "Metrics come from real activity, not manual entry." \
  "Cloud Functions compute participation, attendance from check-ins (not RSVPs), service hours and active members" \
  "Results stored per period for fast reads" \
  "Goal targets are configurable, none presented as national requirements")")
k+=("$(ticket "Approve or decline membership requests" "admin,auth" "$M4" "Leadership 1: Leadership home" "As an officer, I want to approve new members from my phone." \
  "Pending requests listed with name and initiation term" \
  "Approve or decline inline; decision logged")")
k+=("$(ticket "Attendance check-in" "admin,events" "$M4" "Leadership 2: Take attendance" "As an officer, I want to check brothers in at an event." \
  "Checked-in count vs RSVPs with progress bar" \
  "Search, RSVP'd vs all filter, tap to check in, add walk-in" \
  "Optional service hours logged for everyone checked in; metrics update on save")")
k+=("$(ticket "Reports queue" "admin,moderation,app-store" "$M4" "Leadership 3: Review reports" "As an officer, I want to review reported content quickly." \
  "Report cards with reason, count and preview" \
  "Keep, Remove, or Restrict (pause posting 7 days); undo" \
  "Every decision logged with the officer's name; reporter notified")")
epic "Chapter + Leadership" "$M4" "Chapter hub, member progress and the mobile leadership tools." "${k[@]}"

# ---------- M5 Launch ----------
say "Creating M5 tickets..."
k=()
k+=("$(chore "Confirm branding with national" "design" "$M5" "Make sure the name, letters and colors are allowed in the app and store listing." \
  "Client confirms use of Sigma Sigma Lambda, the Greek letters and black and old gold" \
  "Any restricted marks removed or replaced")")
k+=("$(chore "App icon, splash and store listing" "design" "$M5" "Store pages ready." \
  "App icon and splash screen" \
  "Screenshots and descriptions for the App Store and Google Play")")
k+=("$(chore "Privacy policy, terms and support contact" "app-store" "$M5" "Legal pages required for review." \
  "Privacy policy and terms published at a public URL" \
  "Support email listed in the app and the store listing" \
  "App privacy details filled in for Apple and Google")")
k+=("$(chore "Beta test with chapter officers" "infra" "$M5" "Real users find problems before launch." \
  "TestFlight and Play internal testing with officers" \
  "Feedback triaged into issues")")
k+=("$(chore "Submit to App Store and Google Play" "infra,app-store" "$M5" "The app is live." \
  "Builds submitted and review feedback fixed" \
  "Release notes and version tagged in git")")
epic "Launch" "$M5" "Everything needed to get through store review and go live." "${k[@]}"

# ---------- Later ----------
say "Creating Later tickets..."
k=()
k+=("$(ticket "Desktop officer dashboard" "admin" "$ML" "Chapter Health Dashboard (officer, desktop)" "As an officer, I want a bigger view for meetings." \
  "Web dashboard with goals, KPIs, trend chart and needs attention")")
k+=("$(ticket "Program board view" "admin,chapter" "$ML" "Annual Programs + KPIs (officer, desktop)" "As an officer, I want a board of programs by status." \
  "Columns: Not started, In progress, At risk, Completed")")
k+=("$(ticket "Goal and KPI configuration" "admin" "$ML" "Annual Programs + KPIs (officer, desktop)" "As an admin, I want to set the chapter's goals and targets." \
  "Create, edit and archive goals and KPI targets per chapter year")")
k+=("$(ticket "In-app payments with Stripe" "backend" "$ML" "Not mocked yet" "As a member, I want to pay dues and event fees in the app." \
  "Stripe Checkout with the chapter as merchant of record; no stored balances or transfers" \
  "Receipts and payment history; officer collection summary" \
  "Legal and tax review before launch")")
k+=("$(ticket "Dark mode" "design" "$ML" "All screens" "As a member, I want a dark theme." \
  "Dark token set with AA contrast; follows the system setting")")
epic "Later" "$ML" "Not in the first release. Pull in as budget allows." "${k[@]}"

# ---------- Project board ----------
if [ "$DRY_RUN" = "1" ]; then
  say "Dry run done. $(wc -l < "$URLS_FILE") issues would be created."
  exit 0
fi

say "Creating project board..."
if PROJECT_NUM="$(gh project create --owner "$OWNER" --title "$PROJECT_TITLE" --format json --jq .number 2>/dev/null)"; then
  while read -r url; do
    gh project item-add "$PROJECT_NUM" --owner "$OWNER" --url "$url" >/dev/null && sleep 0.5
  done < "$URLS_FILE"
  say "Added $(wc -l < "$URLS_FILE") items to project #$PROJECT_NUM."
else
  say "Couldn't create the project. Run: gh auth refresh -s project, then create it on GitHub and add the issues."
fi

say "Done. Issues: https://github.com/$REPO/issues"
