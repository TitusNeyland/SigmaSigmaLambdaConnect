import { describe, expect, it } from 'vitest';

import { reportEmail, reportFields, validEmails } from './committeeReports';

describe('validEmails', () => {
  it('keeps real addresses once each, lowercased, up to ten', () => {
    expect(validEmails([' VP1@Example.com ', 'vp1@example.com', 'not an email', 7, ''])).toEqual([
      'vp1@example.com',
    ]);
    expect(validEmails(Array.from({ length: 12 }, (_, i) => `vp${i}@example.com`))).toHaveLength(
      10,
    );
    expect(validEmails(undefined)).toEqual([]);
  });
});

describe('reportFields', () => {
  it('needs a committee, period and summary', () => {
    expect(reportFields({ committee: ' Service ', period: 'Oct', summary: 'Did things' })).toEqual({
      committee: 'Service',
      period: 'Oct',
      summary: 'Did things',
    });
    expect(reportFields({ committee: 'Service', period: '', summary: 'x' })).toBeNull();
  });
});

describe('reportEmail', () => {
  const report = { committee: 'Service', period: 'October 2026', summary: 'Two park cleanups.' };

  it('says who sent which report, with the summary and the file', () => {
    const email = reportEmail(report, 'Sample Chris', 'october.pdf');
    expect(email.subject).toBe('Service committee report: October 2026');
    expect(email.text).toBe(
      [
        'Sample Chris submitted the Service committee report for October 2026.',
        '',
        'Two park cleanups.',
        '',
        'Attached: october.pdf',
        'Sent from Sigma Sigma Lambda Connect.',
      ].join('\n'),
    );
  });

  it('leaves out the file line without one, and escapes the HTML', () => {
    const email = reportEmail({ ...report, summary: 'Raised <$500> & more' }, 'Sample Chris', null);
    expect(email.text).not.toMatch(/Attached/);
    expect(email.html).toContain('Raised &#60;$500&#62; &#38; more');
    expect(email.html).not.toContain('<$500>');
  });
});
