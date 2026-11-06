import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

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
const directory = jest.requireMock<typeof import('@/data/__mocks__/directory')>('@/data/directory');
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
const programs = jest.requireMock<typeof import('@/data/__mocks__/programs')>('@/data/programs');

const me = () => auth.sampleUser().uid;

const PROGRAM = programs.sampleProgram({
  id: 'p1',
  name: 'Sample food drive',
  ownerId: null,
  ownerName: '',
  ownerTitle: 'Service committee',
  status: 'in_progress',
  milestones: [
    { id: 'm1', name: 'Book the venue', order: 1, done: true },
    { id: 'm2', name: 'Print flyers', order: 2, done: false },
  ],
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}
const tap = (testID: string) => press(screen.getByTestId(testID));
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
  signIn({ role: 'officer', title: 'President' });
  programs.resetProgramsMock([PROGRAM]);
  directory.resetDirectoryMock([
    directory.sampleEntry({ uid: 'sample-zed', displayName: 'Zed Allen', headline: 'Teacher' }),
    directory.sampleEntry({ uid: 'sample-ty', displayName: 'Ty Baker' }),
  ]);
});

describe('setting up a program', () => {
  it('officers start one from the Programs page', async () => {
    await renderRouter('src/app', { initialUrl: '/chapter/progress' });
    await waitFor(() => expect(screen.getByTestId('progress-new')).toBeTruthy());
    await tap('progress-new');
    await waitFor(() => expect(screen.getByRole('header', { name: 'New program' })).toBeTruthy());
  });

  it('members don’t see New', async () => {
    signIn(null);
    await renderRouter('src/app', { initialUrl: '/chapter/progress' });
    await waitFor(() => expect(screen.getByText('Sample food drive')).toBeTruthy());
    expect(screen.queryByTestId('progress-new')).toBeNull();
  });

  it('members can’t open the form', async () => {
    signIn(null);
    await renderRouter('src/app', { initialUrl: '/chapter/programs/new' });
    await waitFor(() =>
      expect(screen.getByText('Only officers can set up programs.')).toBeTruthy(),
    );
  });

  it('with no programs yet, officers get a button to make the first one', async () => {
    programs.resetProgramsMock([]);
    await renderRouter('src/app', { initialUrl: '/chapter/progress' });
    await waitFor(() => expect(screen.getByTestId('progress-empty-new')).toBeTruthy());
  });

  it('creates a program with its lead, due date and milestones in order, then opens it', async () => {
    await renderRouter('src/app', { initialUrl: '/chapter/programs/new' });
    await waitFor(() => expect(screen.getByTestId('program-form-name')).toBeTruthy());
    await type('program-form-name', ' Sample food drive ');
    await type('program-form-description', 'Cans for the sample pantry.');
    // Pick the lead from the directory.
    await tap('program-form-lead');
    await waitFor(() => expect(screen.getByTestId('lead-sample-zed')).toBeTruthy());
    await tap('lead-sample-zed');
    expect(screen.getByTestId('program-form-lead')).toHaveTextContent(/Zed Allen/);
    await type('program-form-owner-title', 'Service committee');
    const due = new Date(Date.now() + 60 * 86_400_000);
    await act(async () => {
      screen.getByTestId('program-form-due').props.onChange({ type: 'set' }, due);
    });
    // Milestones: type two, add a blank third, and swap the first two.
    await type('program-form-milestone-1', 'Collect cans');
    await tap('program-form-add-milestone');
    await type('program-form-milestone-2', 'Book the venue');
    await tap('program-form-add-milestone');
    await tap('program-form-up-2');
    await tap('program-form-submit');

    expect(programs.createProgram).toHaveBeenCalledWith(
      {
        name: 'Sample food drive',
        description: 'Cans for the sample pantry.',
        ownerId: 'sample-zed',
        ownerName: 'Zed Allen',
        ownerTitle: 'Service committee',
        dueAt: due,
        milestones: [{ name: 'Book the venue' }, { name: 'Collect cans' }],
      },
      me(),
    );
    await waitFor(() => expect(screen).toHavePathname('/chapter/programs/new-program'));
  });

  it('says what’s missing and saves nothing', async () => {
    await renderRouter('src/app', { initialUrl: '/chapter/programs/new' });
    await waitFor(() => expect(screen.getByTestId('program-form-submit')).toBeTruthy());
    await tap('program-form-submit');
    expect(screen.getByText('Give the program a name.')).toBeTruthy();
    expect(screen.getByTestId('program-form-milestones-error')).toHaveTextContent(
      'Add at least one milestone.',
    );
    expect(programs.createProgram).not.toHaveBeenCalled();
  });
});

describe('editing a program', () => {
  async function openEdit() {
    await renderRouter('src/app', { initialUrl: '/chapter/programs/p1' });
    await waitFor(() => expect(screen.getByTestId('program-edit')).toBeTruthy());
    await tap('program-edit');
    await waitFor(() => expect(screen.getByRole('header', { name: 'Edit program' })).toBeTruthy());
  }

  it('opens filled in, and saves renamed, added and removed milestones', async () => {
    await openEdit();
    expect(screen.getByTestId('program-form-name').props.value).toBe('Sample food drive');
    expect(screen.getByTestId('program-form-milestone-2').props.value).toBe('Print flyers');
    await tap('program-form-remove-2');
    await tap('program-form-add-milestone');
    await type('program-form-milestone-2', 'Deliver to the pantry');
    await type('program-form-milestone-1', 'Book the hall');
    await tap('program-form-submit');
    expect(programs.updateProgram).toHaveBeenCalledWith(
      PROGRAM,
      expect.objectContaining({
        name: 'Sample food drive',
        milestones: [{ id: 'm1', name: 'Book the hall' }, { name: 'Deliver to the pantry' }],
      }),
    );
    await waitFor(() => expect(screen).toHavePathname('/chapter/programs/p1'));
  });

  it('deletes it after asking, back to the Programs page', async () => {
    await renderRouter('src/app', { initialUrl: '/chapter/progress' });
    await waitFor(() => expect(screen.getByText('Sample food drive')).toBeTruthy());
    // Tapping a program expands it; Open program goes to its page.
    await press(screen.getByText('Sample food drive'));
    await tap('program-open-p1');
    await waitFor(() => expect(screen.getByTestId('program-edit')).toBeTruthy());
    await tap('program-edit');
    await waitFor(() => expect(screen.getByTestId('program-form-delete')).toBeTruthy());
    await tap('program-form-delete');
    await tap('confirm-delete-program');
    expect(programs.deleteProgram).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(screen).toHavePathname('/chapter/progress'));
  });
});

describe('the program’s lead', () => {
  beforeEach(() => {
    // A member, not an officer, leading this program.
    signIn(null);
    programs.resetProgramsMock([{ ...PROGRAM, ownerId: me(), ownerName: 'Marcus Reed' }]);
  });

  it('checks milestones off and flags it as needing help, but can’t edit it', async () => {
    await renderRouter('src/app', { initialUrl: '/chapter/programs/p1' });
    await waitFor(() => expect(screen.getByTestId('program-needs-help')).toBeTruthy());
    expect(screen.getByTestId('program-led-by')).toHaveTextContent(
      'Led by Marcus Reed · Service committee',
    );
    expect(screen.queryByTestId('program-edit')).toBeNull();
    await tap('milestone-m2');
    expect(programs.setMilestoneDone).toHaveBeenCalledWith('p1', 'm2', true, me(), 'completed');
    // Done now, so there's nothing left to flag.
    expect(screen.queryByTestId('program-needs-help')).toBeNull();
  });

  it('flags Needs help, which shows on the program', async () => {
    await renderRouter('src/app', { initialUrl: '/chapter/programs/p1' });
    await waitFor(() => expect(screen.getByTestId('program-needs-help')).toBeTruthy());
    await act(async () => {
      fireEvent(screen.getByTestId('program-needs-help'), 'valueChange', true);
    });
    expect(programs.setNeedsHelp).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), true);
    expect(screen.getByTestId('program-status')).toHaveTextContent('Needs help');
  });

  it('other members only see the checklist', async () => {
    programs.resetProgramsMock([{ ...PROGRAM, ownerId: 'sample-zed', ownerName: 'Zed Allen' }]);
    await renderRouter('src/app', { initialUrl: '/chapter/programs/p1' });
    await waitFor(() => expect(screen.getByTestId('program-led-by')).toBeTruthy());
    expect(screen.queryByTestId('program-needs-help')).toBeNull();
    expect(screen.getByTestId('milestone-m2').props.accessibilityRole).not.toBe('checkbox');
  });
});
