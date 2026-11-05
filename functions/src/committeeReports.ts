import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

/**
 * Committee reports: any approved member submits one in the app (Chapter > Documents), and
 * this emails it, with its file, to the addresses admins set in settings/reportRecipients.
 * Mail goes through Resend (resend.com). Its API key is a Firebase secret:
 *
 *   firebase functions:secrets:set RESEND_API_KEY --project dev
 *
 * REPORTS_FROM is the sender. Resend's test sender only delivers to the Resend account's
 * own address; verify the chapter's domain in Resend and set REPORTS_FROM to send to anyone.
 */
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const REPORTS_FROM = defineString('REPORTS_FROM', {
  default: 'Sigma Sigma Lambda <onboarding@resend.dev>',
});

export const RESEND_URL = 'https://api.resend.com/emails';
export const RECIPIENTS_DOC = 'settings/reportRecipients';
/** Most addresses a report goes to. Matches the rules. */
export const MAX_RECIPIENTS = 10;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The usable addresses in a list, each once, lowercased. */
export function validEmails(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const emails = list.map((e) => text(e).toLowerCase()).filter((e) => EMAIL.test(e));
  return [...new Set(emails)].slice(0, MAX_RECIPIENTS);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\n/g, '<br>');

export type ReportFields = { committee: string; period: string; summary: string };

export function reportFields(data: Record<string, unknown>): ReportFields | null {
  const fields = {
    committee: text(data.committee),
    period: text(data.period),
    summary: text(data.summary),
  };
  return fields.committee && fields.period && fields.summary ? fields : null;
}

/** The email for a report. Plain words, the summary as written. */
export function reportEmail(report: ReportFields, by: string, fileName: string | null) {
  const subject = `${report.committee} committee report: ${report.period}`;
  const lines = [
    `${by} submitted the ${report.committee} committee report for ${report.period}.`,
    '',
    report.summary,
    '',
    fileName ? `Attached: ${fileName}` : '',
    'Sent from Sigma Sigma Lambda Connect.',
  ].filter((l, i, all) => l !== '' || all[i - 1] !== '');
  return {
    subject,
    text: lines.join('\n'),
    html: lines.map((l) => (l ? `<p>${escapeHtml(l)}</p>` : '')).join(''),
  };
}

export type ReportDeps = {
  db?: Firestore;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  from?: string;
  /** Reads an uploaded file. Defaults to the project's Storage bucket. */
  download?: (path: string) => Promise<Buffer>;
  /** The submitter's sign-in email, so VPs can reply. */
  emailOf?: (uid: string) => Promise<string | null>;
};

export type EmailStatus = 'sent' | 'failed' | 'no_recipients' | 'invalid';

/**
 * Emails a new report to the chapter's report recipients, then records on the report how
 * it went (never who it went to, since members can read their own reports).
 */
export async function emailReport(
  id: string,
  data: Record<string, unknown>,
  deps: ReportDeps = {},
): Promise<EmailStatus> {
  const db = deps.db ?? getFirestore();
  const ref = db.doc(`committeeReports/${id}`);
  const authorId = text(data.authorId);
  const member = authorId ? await db.doc(`members/${authorId}`).get() : null;
  const by = text(member?.get('displayName')) || 'A brother';
  const finish = async (status: EmailStatus, extra: Record<string, unknown> = {}) => {
    await ref.update({ authorName: by, emailStatus: status, ...extra });
    return status;
  };

  const report = reportFields(data);
  if (!report) return finish('invalid');
  const to = validEmails((await db.doc(RECIPIENTS_DOC).get()).get('emails'));
  if (to.length === 0) return finish('no_recipients');

  try {
    const file = data.attachment as { path?: unknown; name?: unknown } | null | undefined;
    const path = text(file?.path);
    const fileName = path ? text(file?.name) || 'report' : null;
    const download =
      deps.download ?? (async (p: string) => (await getStorage().bucket().file(p).download())[0]);
    const attachments = path
      ? [{ filename: fileName, content: (await download(path)).toString('base64') }]
      : undefined;
    const emailOf =
      deps.emailOf ?? (async (uid: string) => (await getAuth().getUser(uid)).email ?? null);
    const replyTo = authorId ? await emailOf(authorId).catch(() => null) : null;

    const email = reportEmail(report, by, fileName);
    const res = await (deps.fetchImpl ?? fetch)(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deps.apiKey ?? RESEND_API_KEY.value()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: deps.from ?? REPORTS_FROM.value(),
        to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments ? { attachments } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Resend answered ${res.status}: ${await res.text()}`);
    return finish('sent', { emailedAt: FieldValue.serverTimestamp(), emailedCount: to.length });
  } catch (error) {
    logger.error('Committee report email failed', { id, error: String(error) });
    return finish('failed');
  }
}

export const emailCommitteeReport = onDocumentCreated(
  { document: 'committeeReports/{id}', secrets: [RESEND_API_KEY] },
  async (event) => {
    const data = event.data?.data();
    if (data) await emailReport(event.params.id, data);
  },
);
