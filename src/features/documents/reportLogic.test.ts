import {
  allowedType,
  canSubmit,
  emailStatus,
  fileProblem,
  fileSize,
  fileType,
  MAX_FILE_BYTES,
  parseEmails,
  reportTitle,
  shortDate,
} from './reportLogic';

describe('files', () => {
  it('takes the phone’s type, or works it out from the name', () => {
    expect(fileType('a.pdf', 'application/pdf')).toBe('application/pdf');
    expect(fileType('Minutes.DOCX')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(fileType('photo.HEIC', null)).toBe('image/heic');
    expect(fileType('notes')).toBe('application/octet-stream');
  });

  it('allows PDFs, Word files and photos, under 10 MB', () => {
    expect(allowedType('application/pdf')).toBe(true);
    expect(allowedType('application/msword')).toBe(true);
    expect(allowedType('image/jpeg')).toBe(true);
    expect(allowedType('application/zip')).toBe(false);
    expect(fileProblem({ mimeType: 'application/pdf', size: 1000 })).toBeNull();
    expect(fileProblem({ mimeType: 'application/zip', size: 1000 })).toBe(
      'Attach a PDF, Word file or photo.',
    );
    expect(fileProblem({ mimeType: 'application/pdf', size: MAX_FILE_BYTES })).toBe(
      'Files can be up to 10 MB.',
    );
  });

  it('reads sizes plainly', () => {
    expect(fileSize(820)).toBe('820 bytes');
    expect(fileSize(240 * 1024)).toBe('240 KB');
    expect(fileSize(1.25 * 1024 * 1024)).toBe('1.3 MB');
  });
});

describe('reports', () => {
  const ok = { committee: 'Service', period: 'October 2026', summary: 'Two cleanups.' };

  it('needs a committee, period and summary within their limits', () => {
    expect(canSubmit(ok)).toBe(true);
    expect(canSubmit({ ...ok, committee: '  ' })).toBe(false);
    expect(canSubmit({ ...ok, period: '' })).toBe(false);
    expect(canSubmit({ ...ok, summary: 'x'.repeat(5001) })).toBe(false);
  });

  it('titles a report by committee and period', () => {
    expect(reportTitle(ok)).toBe('Service · October 2026');
  });

  it('says whether the email went out', () => {
    expect(emailStatus({ emailStatus: 'sent' })).toEqual({ label: 'Emailed', tone: 'success' });
    expect(emailStatus({ emailStatus: null }).label).toBe('Sending');
    expect(emailStatus({ emailStatus: 'failed' }).label).toBe('Couldn’t email');
    expect(emailStatus({ emailStatus: 'no_recipients' }).label).toBe(
      'Not emailed: no recipients set',
    );
  });

  it('dates reports, with the year only when it isn’t this year', () => {
    const now = new Date(2026, 10, 5);
    expect(shortDate(new Date(2026, 9, 31), now)).toBe('Oct 31');
    expect(shortDate(new Date(2025, 11, 2), now)).toBe('Dec 2, 2025');
  });
});

describe('parseEmails', () => {
  it('splits on lines, commas and spaces, each once, and flags what isn’t an email', () => {
    expect(parseEmails('VP1@example.com\nvp2@example.com, vp1@example.com  oops')).toEqual({
      emails: ['vp1@example.com', 'vp2@example.com'],
      invalid: ['oops'],
    });
    expect(parseEmails('  ')).toEqual({ emails: [], invalid: [] });
  });
});
