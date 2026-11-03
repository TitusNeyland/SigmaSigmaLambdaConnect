import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COMMUNITY_GUIDELINES_URL,
  PRIVACY_URL,
  SITE_URL,
  SUPPORT_EMAIL,
  TERMS_URL,
} from '../src/config/app';
import { GUIDELINES } from '../src/features/guidelines/guidelines';
import { buildSite, escapeHtml, renderSite } from '../tools/site/build';

// The public support and policy pages (#54), built from tools/site.

const site = renderSite();
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('public site', () => {
  it('has a page for every link the app opens', () => {
    for (const url of [PRIVACY_URL, TERMS_URL, COMMUNITY_GUIDELINES_URL]) {
      expect(url.startsWith(`${SITE_URL}/`)).toBe(true);
      expect(site[`${url.slice(SITE_URL.length + 1)}.html`], url).toBeDefined();
    }
    expect(site['index.html']).toBeDefined();
  });

  it('fills in the support email everywhere and leaves no placeholders', () => {
    for (const [name, html] of Object.entries(site)) {
      expect(html, name).not.toMatch(/\{\{|\}\}/);
      expect(html, name).toContain(`mailto:${SUPPORT_EMAIL}`);
    }
  });

  it('shows the same guidelines as the app', () => {
    const page = text(site['guidelines.html']);
    for (const g of GUIDELINES) {
      expect(page).toContain(escapeHtml(g.title));
      expect(page).toContain(escapeHtml(g.body));
    }
  });

  it('the privacy policy covers what reviewers check', () => {
    const page = text(site['privacy.html']).toLowerCase();
    for (const phrase of ['delete account', 'firebase', 'expo', 'officers', 'under 18']) {
      expect(page).toContain(phrase);
    }
  });

  it('every page links home, works on a phone and uses no em dashes', () => {
    for (const [name, html] of Object.entries(site)) {
      expect(html, name).toContain('<meta name="viewport"');
      expect(html, name).toContain('href="/"');
      expect(html, name).not.toContain('—');
    }
  });

  it('builds the files Firebase Hosting serves', () => {
    const out = mkdtempSync(join(tmpdir(), 'site-'));
    buildSite(out);
    for (const f of [
      'index.html',
      'privacy.html',
      'terms.html',
      'guidelines.html',
      'favicon.png',
    ]) {
      expect(existsSync(join(out, f)), f).toBe(true);
    }
    expect(readFileSync(join(out, 'terms.html'), 'utf8')).toContain('Terms of use');
  });
});
