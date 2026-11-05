import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
const roles = jest.requireMock<typeof import('@/data/__mocks__/roles')>('@/data/roles');
jest.mock('@/data/profile');
jest.mock('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
jest.mock('@/data/eventAdmin');
jest.mock('@/data/feed');
jest.mock('@/data/likes');
jest.mock('@/data/posts');
jest.mock('@/data/comments');
jest.mock('@/data/programs');
jest.mock('@/data/announcements');
jest.mock('@/data/leadership');
jest.mock('@/data/requests');
jest.mock('@/data/attendance');
jest.mock('@/data/moderation');
// Mocked for every app test in jest.setup.js.
const data =
  jest.requireMock<typeof import('@/data/__mocks__/committeeReports')>('@/data/committeeReports');
const picker = jest.requireMock<{
  getDocumentAsync: jest.Mock;
  __setPick: (r: object) => void;
}>('expo-document-picker');

const me = () => auth.sampleUser().uid;

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

async function type(testID: string, text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(testID), text);
  });
}

function signIn(role: Parameters<typeof roles.resetRolesMock>[0]) {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  roles.resetRolesMock(role);
  auth.setMockUser(auth.sampleUser());
}

beforeEach(() => {
  signIn(null);
  data.resetCommitteeReportsMock([
    data.sampleReport({ id: 'mine', authorId: me(), authorName: 'Sample Me' }),
    data.sampleReport({ id: 'theirs', committee: 'Scholarship', emailStatus: null }),
  ]);
  picker.__setPick({ canceled: true, assets: null });
});

async function open(url: string) {
  const r = await renderRouter('src/app', { initialUrl: url });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
  return r;
}

describe('Documents', () => {
  it('members see their own reports and can submit one', async () => {
    const r = await open('/chapter/documents');
    expect(screen.getByRole('header', { name: 'Documents' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'YOUR REPORTS' })).toBeTruthy();
    expect(screen.getByTestId('report-mine')).toBeTruthy();
    expect(screen.queryByTestId('report-theirs')).toBeNull();
    expect(screen.getByTestId('report-mine').props.accessibilityLabel).toMatch(
      /^Service · October 2026, /,
    );
    expect(screen.queryByTestId('recipients-entry')).toBeNull();
    expect(data.fetchRecipients).not.toHaveBeenCalled();
    await press(screen.getByTestId('submit-report'));
    expect(r.getPathname()).toBe('/chapter/documents/new');
  });

  it('officers see every report, with who sent it and whether it was emailed', async () => {
    signIn({ role: 'officer', title: 'Vice President' });
    await open('/chapter/documents');
    expect(screen.getByRole('header', { name: 'ALL REPORTS' })).toBeTruthy();
    expect(screen.getByTestId('report-theirs')).toHaveTextContent(/Sample Chris/);
    expect(screen.getByTestId('report-theirs')).toHaveTextContent(/Sending/);
    expect(screen.getByTestId('report-mine')).toHaveTextContent(/Emailed/);
    expect(screen.queryByTestId('recipients-entry')).toBeNull();
  });

  it('admins also set who reports go to', async () => {
    signIn({ role: 'admin', title: 'President' });
    data.setMockRecipients(['vp@example.com']);
    const r = await open('/chapter/documents');
    expect(screen.getByTestId('recipients-entry')).toHaveTextContent(/1/);
    await press(screen.getByTestId('recipients-entry'));
    expect(r.getPathname()).toBe('/chapter/documents/recipients');
  });

  it('says when there are none, and offers Try again', async () => {
    data.resetCommitteeReportsMock([]);
    data.failReportsLoad();
    await open('/chapter/documents');
    await press(screen.getByTestId('documents-retry'));
    await waitFor(() => expect(screen.getByTestId('reports-empty')).toBeTruthy());
  });
});

describe('submitting a report', () => {
  async function fill() {
    await type('report-committee', 'Service');
    await type('report-period', 'November 2026');
    await type('report-summary', 'Sample. Three park cleanups.');
  }

  it('sends the report and goes back to Documents', async () => {
    const r = await renderRouter('src/app', { initialUrl: '/chapter/documents' });
    await waitFor(() => expect(screen.getByTestId('submit-report')).toBeTruthy());
    await press(screen.getByTestId('submit-report'));
    expect(screen.getByTestId('report-send').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fill();
    await press(screen.getByTestId('report-send'));
    expect(data.submitReport).toHaveBeenCalledWith(
      me(),
      'new-1',
      { committee: 'Service', period: 'November 2026', summary: 'Sample. Three park cleanups.' },
      null,
    );
    expect(data.uploadReportFile).not.toHaveBeenCalled();
    await waitFor(() => expect(r.getPathname()).toBe('/chapter/documents'));
    await waitFor(() => expect(screen.getByTestId('report-new-1')).toHaveTextContent(/Sending/));
  });

  it('attaches a file, uploads it first, and can remove it', async () => {
    picker.__setPick({
      canceled: false,
      assets: [
        { uri: 'file:///nov.pdf', name: 'nov.pdf', mimeType: 'application/pdf', size: 2048 },
      ],
    });
    await open('/chapter/documents/new');
    await fill();
    await press(screen.getByTestId('report-attach'));
    await waitFor(() => expect(screen.getByTestId('report-file')).toHaveTextContent(/nov\.pdf/));
    expect(screen.getByTestId('report-file')).toHaveTextContent(/2 KB/);
    await press(screen.getByTestId('report-file-remove'));
    expect(screen.queryByTestId('report-file')).toBeNull();
    await press(screen.getByTestId('report-attach'));
    await waitFor(() => expect(screen.getByTestId('report-file')).toBeTruthy());
    await press(screen.getByTestId('report-send'));
    expect(data.uploadReportFile).toHaveBeenCalledWith(
      me(),
      'new-1',
      { uri: 'file:///nov.pdf', name: 'nov.pdf', mimeType: 'application/pdf', size: 2048 },
      expect.any(Function),
    );
    expect(data.submitReport.mock.calls[0][3]).toMatchObject({
      path: `committeeReports/${me()}/new-1/nov.pdf`,
    });
  });

  it('turns away files it can’t send', async () => {
    picker.__setPick({
      canceled: false,
      assets: [{ uri: 'file:///a.zip', name: 'a.zip', mimeType: 'application/zip', size: 10 }],
    });
    await open('/chapter/documents/new');
    await press(screen.getByTestId('report-attach'));
    await waitFor(() => expect(screen.getByText('Attach a PDF, Word file or photo.')).toBeTruthy());
    expect(screen.queryByTestId('report-file')).toBeNull();
  });

  it('keeps what they wrote when sending fails', async () => {
    data.failNextSubmit();
    await open('/chapter/documents/new');
    await fill();
    await press(screen.getByTestId('report-send'));
    expect(screen.getByTestId('report-error')).toBeTruthy();
    expect(screen.getByTestId('report-committee').props.value).toBe('Service');
  });
});

describe('a report', () => {
  it('shows the summary and opens its file', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    data.resetCommitteeReportsMock([
      data.sampleReport({
        id: 'mine',
        authorId: me(),
        attachment: {
          path: 'committeeReports/me/mine/oct.pdf',
          name: 'oct.pdf',
          contentType: 'application/pdf',
          size: 4096,
        },
      }),
    ]);
    await open('/chapter/documents/mine');
    expect(screen.getByRole('header', { name: 'Service' })).toBeTruthy();
    expect(screen.getByTestId('report-meta')).toHaveTextContent(/^October 2026 · Sample Chris · /);
    expect(screen.getByTestId('report-summary-text')).toHaveTextContent(/park cleanups/);
    await press(screen.getByTestId('report-open-file'));
    expect(openURL).toHaveBeenCalledWith('https://example.test/committeeReports/me/mine/oct.pdf');
    openURL.mockRestore();
  });

  it('says so when it isn’t theirs to read', async () => {
    await open('/chapter/documents/missing');
    expect(screen.getByText('This report isn’t available.')).toBeTruthy();
  });
});

describe('report recipients', () => {
  it('admins set the addresses, one per line', async () => {
    signIn({ role: 'admin', title: 'President' });
    data.setMockRecipients(['vp@example.com']);
    await open('/chapter/documents/recipients');
    expect(screen.getByTestId('recipients-emails').props.value).toBe('vp@example.com');
    await type('recipients-emails', 'vp@example.com\nnot-an-email');
    expect(screen.getByText('Not an email address: not-an-email')).toBeTruthy();
    expect(screen.getByTestId('recipients-save').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await type('recipients-emails', 'VP@example.com\nsecond.vp@example.com');
    await press(screen.getByTestId('recipients-save'));
    expect(data.saveRecipients).toHaveBeenCalledWith(me(), [
      'vp@example.com',
      'second.vp@example.com',
    ]);
  });

  it('is admins only, even for officers', async () => {
    signIn({ role: 'officer', title: 'Vice President' });
    await renderRouter('src/app', { initialUrl: '/chapter/documents/recipients' });
    await waitFor(() => expect(screen.getByTestId('recipients-denied')).toBeTruthy());
    expect(data.fetchRecipients).not.toHaveBeenCalled();
  });
});
