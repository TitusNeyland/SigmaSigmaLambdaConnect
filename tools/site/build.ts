/**
 * Builds the public support, privacy, terms and guidelines pages (#54) into build/site, which
 * Firebase Hosting serves (`firebase deploy --only hosting`). The support email and the
 * guidelines come from the app's own source, so the site and the app always match.
 *
 * Run: npx tsx tools/site/build.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { CHAPTER_NAME, SUPPORT_EMAIL } from '../../src/config/app';
import {
  GUIDELINES,
  GUIDELINES_INTRO,
  GUIDELINES_TITLE,
} from '../../src/features/guidelines/guidelines';

/** Shown on the privacy policy and terms. Update it whenever their wording changes. */
export const POLICIES_UPDATED = 'November 5, 2026';

const PAGES = resolve(__dirname, 'pages');
export const DEFAULT_OUT = resolve(__dirname, '..', '..', 'build', 'site');

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.png">
<style>
  :root { --ink: #111111; --secondary: #6E6E73; --link: #8A6A1F; --separator: #E5E5EA; --bg: #FFFFFF; }
  body { margin: 0; background: var(--bg); color: var(--ink);
    font: 17px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  header { border-bottom: 1px solid var(--separator); padding: 16px; }
  header a { color: var(--ink); font-weight: 700; text-decoration: none; }
  main { max-width: 680px; margin: 0 auto; padding: 16px 16px 64px; }
  h1 { font-size: 34px; line-height: 1.2; margin: 24px 0 8px; }
  h2 { font-size: 20px; margin: 32px 0 8px; }
  a { color: var(--link); }
  .lead { font-size: 19px; }
  .meta { color: var(--secondary); margin-top: 0; }
  li { margin: 6px 0; }
</style>
</head>
<body>
<header><a href="/">ΣΣΛ ${escapeHtml(CHAPTER_NAME)} Connect</a></header>
<main>
${body}
</main>
</body>
</html>
`;
}

function fill(template: string): string {
  return template
    .replaceAll('{{SUPPORT_EMAIL}}', escapeHtml(SUPPORT_EMAIL))
    .replaceAll('{{UPDATED}}', escapeHtml(POLICIES_UPDATED));
}

function guidelinesBody(): string {
  const items = GUIDELINES.map(
    (g) => `<h2>${escapeHtml(g.title)}</h2>\n<p>${escapeHtml(g.body)}</p>`,
  ).join('\n');
  return `<h1>${escapeHtml(GUIDELINES_TITLE)}</h1>\n<p class="lead">${escapeHtml(GUIDELINES_INTRO)}</p>\n${items}\n<p>Questions? Email <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a>.</p>`;
}

/** Page path (as served) → HTML. Clean URLs: /privacy serves privacy.html. */
export function renderSite(): Record<string, string> {
  const page = (file: string) => fill(readFileSync(join(PAGES, file), 'utf8'));
  return {
    'index.html': layout(`${CHAPTER_NAME} Connect`, page('index.html')),
    'privacy.html': layout('Privacy policy', page('privacy.html')),
    'terms.html': layout('Terms of use', page('terms.html')),
    'guidelines.html': layout(GUIDELINES_TITLE, guidelinesBody()),
  };
}

export function buildSite(out = DEFAULT_OUT): string[] {
  const files = renderSite();
  for (const [name, html] of Object.entries(files)) {
    const path = join(out, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, html);
  }
  writeFileSync(
    join(out, 'favicon.png'),
    readFileSync(resolve(__dirname, '..', '..', 'assets', 'images', 'favicon.png')),
  );
  return Object.keys(files);
}

if (require.main === module) {
  console.log(`Built ${buildSite().join(', ')} into ${DEFAULT_OUT}`);
}
