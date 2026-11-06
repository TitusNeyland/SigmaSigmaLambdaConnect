/**
 * Builds the public support, privacy, terms and guidelines pages (#54) into build/site, which
 * Firebase Hosting can serve (`firebase deploy --only hosting`). The policies, the support
 * email and the guidelines come from the app's own source (src/features/legal and
 * src/features/guidelines), so the site and the in-app pages always match.
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
import {
  escapeHtml,
  fillPolicy,
  POLICIES,
  POLICIES_UPDATED,
  policyDocument,
} from '../../src/features/legal/policies';

export { escapeHtml, POLICIES_UPDATED };

const PAGES = resolve(__dirname, 'pages');
export const DEFAULT_OUT = resolve(__dirname, '..', '..', 'build', 'site');

function guidelinesBody(): string {
  const items = GUIDELINES.map(
    (g) => `<h2>${escapeHtml(g.title)}</h2>\n<p>${escapeHtml(g.body)}</p>`,
  ).join('\n');
  return `<h1>${escapeHtml(GUIDELINES_TITLE)}</h1>\n<p class="lead">${escapeHtml(GUIDELINES_INTRO)}</p>\n${items}\n<p>Questions? Email <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a>.</p>`;
}

/** Page path (as served) → HTML. Clean URLs: /privacy serves privacy.html. */
export function renderSite(): Record<string, string> {
  const home = fillPolicy(readFileSync(join(PAGES, 'index.html'), 'utf8'));
  return {
    'index.html': policyDocument(`${CHAPTER_NAME} Connect`, home),
    'privacy.html': policyDocument(POLICIES.privacy.title, fillPolicy(POLICIES.privacy.body)),
    'terms.html': policyDocument(POLICIES.terms.title, fillPolicy(POLICIES.terms.body)),
    'guidelines.html': policyDocument(GUIDELINES_TITLE, guidelinesBody()),
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
