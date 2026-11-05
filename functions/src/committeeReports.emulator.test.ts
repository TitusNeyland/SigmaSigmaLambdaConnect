import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { emailReport, RESEND_URL, type ReportDeps } from './committeeReports';

// Runs against the Firestore emulator (npm run test:rules). Resend and Storage are faked.

let app: App;
let db: Firestore;

const report = (extra: object = {}) => ({
  authorId: 'chris',
  committee: 'Service',
  period: 'October 2026',
  summary: 'Two park cleanups.',
  attachment: null,
  createdAt: Timestamp.now(),
  ...extra,
});

function fakeResend(status = 200) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] =
    [];
  const fetchImpl = vi.fn(
    async (url: string, init: { headers: Record<string, string>; body: string }) => {
      calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      return { ok: status < 300, status, text: async () => 'nope' };
    },
  );
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

async function submit(id: string, data: object, deps: ReportDeps) {
  await db.doc(`committeeReports/${id}`).set(data);
  const status = await emailReport(id, data as Record<string, unknown>, deps);
  return { status, doc: (await db.doc(`committeeReports/${id}`).get()).data()! };
}

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'committee-reports-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of ['members', 'committeeReports', 'settings']) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc('members/chris').set({ displayName: 'Sample Chris', status: 'approved' });
  await db.doc('settings/reportRecipients').set({
    emails: ['vp1@example.com', 'VP2@example.com', 'broken'],
  });
});

const deps = (resend: ReturnType<typeof fakeResend>, extra: Partial<ReportDeps> = {}) => ({
  db,
  fetchImpl: resend.fetchImpl,
  apiKey: 'test-key',
  from: 'Sigma Sigma Lambda <reports@example.com>',
  emailOf: async () => 'chris@example.com',
  ...extra,
});

describe('emailing a committee report', () => {
  it('sends it to the recipients, replying to the member, and records that it went', async () => {
    const resend = fakeResend();
    const { status, doc } = await submit('r1', report(), deps(resend));
    expect(status).toBe('sent');
    expect(resend.calls).toHaveLength(1);
    const [call] = resend.calls;
    expect(call.url).toBe(RESEND_URL);
    expect(call.headers.Authorization).toBe('Bearer test-key');
    expect(call.body).toMatchObject({
      from: 'Sigma Sigma Lambda <reports@example.com>',
      to: ['vp1@example.com', 'vp2@example.com'],
      subject: 'Service committee report: October 2026',
      reply_to: 'chris@example.com',
    });
    expect(call.body).not.toHaveProperty('attachments');
    expect(doc).toMatchObject({ authorName: 'Sample Chris', emailStatus: 'sent', emailedCount: 2 });
    expect(doc.emailedAt).toBeInstanceOf(Timestamp);
    // Members can read their own report, so who it went to is never written on it.
    expect(JSON.stringify(doc)).not.toContain('vp1@example.com');
  });

  it('attaches the file', async () => {
    const resend = fakeResend();
    const download = vi.fn(async () => Buffer.from('PDF bytes'));
    const attachment = {
      path: 'committeeReports/chris/r2/october.pdf',
      name: 'october.pdf',
      contentType: 'application/pdf',
      size: 9,
    };
    await submit('r2', report({ attachment }), deps(resend, { download }));
    expect(download).toHaveBeenCalledWith('committeeReports/chris/r2/october.pdf');
    expect(resend.calls[0].body.attachments).toEqual([
      { filename: 'october.pdf', content: Buffer.from('PDF bytes').toString('base64') },
    ]);
    expect(resend.calls[0].body.text).toContain('Attached: october.pdf');
  });

  it('records when no recipients are set, without sending', async () => {
    await db.doc('settings/reportRecipients').delete();
    const resend = fakeResend();
    const { status, doc } = await submit('r3', report(), deps(resend));
    expect(status).toBe('no_recipients');
    expect(doc.emailStatus).toBe('no_recipients');
    expect(resend.calls).toHaveLength(0);
  });

  it('records a failure when the email service refuses', async () => {
    const { status, doc } = await submit('r4', report(), deps(fakeResend(422)));
    expect(status).toBe('failed');
    expect(doc).toMatchObject({ emailStatus: 'failed' });
    expect(doc).not.toHaveProperty('emailedAt');
  });

  it('still sends when the member’s email can’t be found', async () => {
    const resend = fakeResend();
    await submit(
      'r5',
      report(),
      deps(resend, {
        emailOf: async () => {
          throw new Error('no user');
        },
      }),
    );
    expect(resend.calls[0].body).not.toHaveProperty('reply_to');
  });
});
