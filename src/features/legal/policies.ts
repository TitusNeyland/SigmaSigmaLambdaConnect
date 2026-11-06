// Relative, not @/: tools/site runs this under Node without the app's path alias.
import { CHAPTER_NAME, SUPPORT_EMAIL } from '../../config/app';

/**
 * The privacy policy and terms (#54), as static HTML. The app shows them in Settings, and
 * tools/site builds the public pages from the same text, so the two never drift apart.
 * {{SUPPORT_EMAIL}} and {{UPDATED}} are filled in by fillPolicy.
 */

/** Shown on the privacy policy and terms. Update it whenever their wording changes. */
export const POLICIES_UPDATED = 'November 5, 2026';

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const PRIVACY_BODY = `<h1>Privacy policy</h1>
<p class="meta">Last updated {{UPDATED}}</p>

<p>
  Sigma Sigma Lambda Connect ("the app") is run by the Sigma Sigma Lambda chapter ("we") for its
  members. This policy explains what the app collects, who can see it and how to delete it.
</p>

<h2>What we collect</h2>
<ul>
  <li>
    <strong>Account:</strong> your email address and password. Passwords are handled by Firebase
    Authentication; we never see them.
  </li>
  <li>
    <strong>Profile:</strong> your name and initiation term, and anything you add: a photo,
    headline, bio, interests, the date you were initiated, and a phone number or email you choose to
    show.
  </li>
  <li>
    <strong>What you share:</strong> posts, photos, captions, comments, likes, and people or events
    you tag.
  </li>
  <li>
    <strong>Chapter activity:</strong> your RSVPs, check-ins and service hours recorded by officers
    at events, and offers to help with chapter programs. Your profile shows totals worked out from
    your check-ins: how many events you attended and your service hours.
  </li>
  <li>
    <strong>Committee reports:</strong> reports you submit, with their summary and any file you
    attach (a PDF, Word file or photo).
  </li>
  <li>
    <strong>Activity:</strong> a list of what's happened that involves you (likes, comments,
    replies, tags, announcements, event reminders), kept so you can see it behind the heart on Home.
  </li>
  <li>
    <strong>Safety:</strong> reports you make, members you block, and posts or comments you hide by
    reporting them.
  </li>
  <li>
    <strong>Settings and notifications:</strong> your notification choices, which announcements
    you've read, and a push token so we can send notifications to your phone. A few small settings,
    like whether you closed the welcome card, are kept only on your phone.
  </li>
</ul>
<p>
  The app only uses your photos and files when you pick them. It uses your camera when you take a
  photo, and, for officers, to scan brothers' check-in codes at events. Your check-in code holds
  only your member ID. Adding an event to your calendar happens on your phone; we don't read your
  calendar.
</p>
<p>
  We don't show ads, sell your information, track you across other apps or websites, or use
  analytics or advertising tools.
</p>

<h2>Who can see it</h2>
<ul>
  <li>
    <strong>Approved members</strong> see your profile, your posts and comments, posts you're tagged
    in, whether you're going to an event, and your number of events attended and service hours. Your
    phone number and email are only shown if you turn them on.
  </li>
  <li>
    <strong>Officers</strong> also see which events you attended, membership requests, reports
    (including who made a report; the person reported is never told) and every committee report.
  </li>
  <li>
    <strong>The chapter's vice presidents</strong>, or whoever the chapter's admins choose, get
    committee reports by email, with any attached file.
  </li>
  <li>
    Nothing in the app is public. New accounts can't see chapter content until an officer approves
    them.
  </li>
</ul>

<h2>Services we use</h2>
<p>
  The app runs on Google Firebase (sign-in, database, file storage and server functions), hosted in
  the United States. Notifications are sent through Expo's push service and Apple's and Google's
  notification services. Committee report emails are sent through Resend. These services process
  data only to run the app.
</p>

<h2>Keeping and deleting your data</h2>
<p>
  We keep your information while you have an account. To delete it, open
  <strong>Profile › Settings › Delete account</strong>. This removes your profile, photos, posts,
  comments, likes, RSVPs, Activity, totals, blocks, notification settings and sign-in.
</p>
<p>
  A few chapter records are kept without your name so the chapter's numbers and records stay
  accurate: event check-ins and service hours, committee reports you submitted, reports that were
  made, and officers' moderation decisions. Committee report emails already sent stay in the
  recipients' inboxes.
</p>
<p>
  If you can't sign in, email <a href="mailto:{{SUPPORT_EMAIL}}">{{SUPPORT_EMAIL}}</a> and we'll
  delete your account for you.
</p>

<h2>Who the app is for</h2>
<p>The app is for adult members of the chapter. It isn't meant for anyone under 18.</p>

<h2>Changes</h2>
<p>If we change this policy, we'll update the date above and let members know in the app.</p>

<h2>Contact</h2>
<p>Email <a href="mailto:{{SUPPORT_EMAIL}}">{{SUPPORT_EMAIL}}</a>.</p>
`;

export const TERMS_BODY = `<h1>Terms of use</h1>
<p class="meta">Last updated {{UPDATED}}</p>

<p>
  These terms cover your use of Sigma Sigma Lambda Connect ("the app"), run by the Sigma Sigma
  Lambda chapter ("we"). By using the app, you agree to them.
</p>

<h2>Who can use it</h2>
<p>
  The app is for members of the chapter who are 18 or older. Officers approve each account and can
  remove access.
</p>

<h2>Your account</h2>
<p>
  Keep your password to yourself and give accurate information about yourself. You're responsible
  for what's posted from your account.
</p>

<h2>What you post</h2>
<p>
  You own what you post. By posting, you let us show it to approved members in the app. You can
  delete your posts and comments at any time.
</p>
<p>
  Only post things you have the right to share, and follow the
  <a href="/guidelines">community guidelines</a>. There's no tolerance for objectionable content or
  abusive members.
</p>

<h2>Moderation</h2>
<p>
  Members can report posts, comments and other members, and block anyone. Officers review reports
  and can remove content, pause someone's posting, or remove access for breaking these terms or the
  guidelines.
</p>

<h2>Leaving</h2>
<p>
  You can delete your account in <strong>Profile › Settings</strong> at any time. See the
  <a href="/privacy">privacy policy</a> for what that removes.
</p>

<h2>No guarantees</h2>
<p>
  The app is provided as is. We'll try to keep it running and accurate, but we can't promise it will
  always be available or free of errors. As far as the law allows, we aren't liable for losses from
  using the app.
</p>

<h2>Changes</h2>
<p>
  We may update these terms. If we do, we'll update the date above and let members know in the app.
</p>

<h2>Contact</h2>
<p>Email <a href="mailto:{{SUPPORT_EMAIL}}">{{SUPPORT_EMAIL}}</a>.</p>
`;

export function fillPolicy(template: string): string {
  return template
    .replaceAll('{{SUPPORT_EMAIL}}', escapeHtml(SUPPORT_EMAIL))
    .replaceAll('{{UPDATED}}', escapeHtml(POLICIES_UPDATED));
}

/** Colors and type, the app's tokens as CSS. Shared by the site and the in-app pages. */
export const POLICY_CSS = `
  :root { --ink: #111111; --secondary: #6E6E73; --link: #8A6A1F; --separator: #E5E5EA; --bg: #FFFFFF; }
  body { margin: 0; background: var(--bg); color: var(--ink);
    font: 17px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-text-size-adjust: 100%; }
  header { border-bottom: 1px solid var(--separator); padding: 16px; }
  header a { color: var(--ink); font-weight: 700; text-decoration: none; }
  main { max-width: 680px; margin: 0 auto; padding: 16px 16px 64px; }
  h1 { font-size: 34px; line-height: 1.2; margin: 24px 0 8px; }
  h2 { font-size: 20px; margin: 32px 0 8px; }
  a { color: var(--link); }
  .lead { font-size: 19px; }
  .meta { color: var(--secondary); margin-top: 0; }
  li { margin: 6px 0; }
`;

/** Links inside the in-app pages use this scheme, so the app can open them itself. */
export const IN_APP_LINK = 'sslconnect-page://';

/**
 * A whole HTML page. On the site it has a header linking home; in the app the screen has its
 * own back button, so it doesn't, and links to other pages (/terms, /guidelines) become
 * in-app links.
 */
export function policyDocument(
  title: string,
  bodyHtml: string,
  where: 'site' | 'app' = 'site',
): string {
  const header =
    where === 'site'
      ? `<header><a href="/">ΣΣΛ ${escapeHtml(CHAPTER_NAME)} Connect</a></header>\n`
      : '';
  const main =
    where === 'app' ? bodyHtml.replace(/href="\/(\w*)"/g, `href="${IN_APP_LINK}$1"`) : bodyHtml;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${where === 'site' ? '<link rel="icon" href="/favicon.png">\n' : ''}<style>${POLICY_CSS}</style>
</head>
<body>
${header}<main>
${main}
</main>
</body>
</html>
`;
}

export type PolicyKind = 'privacy' | 'terms';

export const POLICIES: Record<PolicyKind, { title: string; body: string }> = {
  privacy: { title: 'Privacy policy', body: PRIVACY_BODY },
  terms: { title: 'Terms of use', body: TERMS_BODY },
};
