import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
jest.mock('@/data/profile');
const profile = jest.requireMock<typeof import('@/data/__mocks__/profile')>('@/data/profile');
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

const me = () => auth.sampleUser().uid;

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  directory.resetDirectoryMock([
    directory.sampleEntry({
      uid: me(),
      displayName: 'Marcus Reed',
      industry: 'Technology',
      initiationTerm: 'Spring 2019',
    }),
    directory.sampleEntry({
      uid: 'sample-zed',
      displayName: 'Zed Allen',
      headline: 'Broker',
      industry: 'Real estate',
      businesses: ['Allen Realty'],
      interests: ['Golf'],
      initiationTerm: 'Spring 2019',
    }),
    directory.sampleEntry({
      uid: 'sample-ty',
      displayName: 'Ty Baker',
      industry: 'Real estate',
      businesses: ['Baker Barbershop'],
      interests: ['Travel'],
      initiationTerm: 'Fall 2021',
    }),
  ]);
  auth.setMockUser(auth.sampleUser());
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}
const tap = (testID: string) => press(screen.getByTestId(testID));
const shown = () =>
  ['sample-marcus', 'sample-zed', 'sample-ty'].filter(
    (uid) => screen.queryByTestId(`member-${uid}`) !== null,
  );

describe('finding brothers in the Directory', () => {
  async function openDirectory() {
    await renderRouter('src/app', { initialUrl: '/chapter/directory' });
    await waitFor(() => expect(screen.getByTestId('member-sample-zed')).toBeTruthy());
  }

  it('narrows by industry from a list of what brothers have picked', async () => {
    await openDirectory();
    await tap('refine-industry');
    // Only industries someone has, with how many brothers.
    expect(screen.getByTestId('refine-option-real-estate')).toHaveTextContent(/Real estate.*2/);
    expect(screen.queryByTestId('refine-option-law')).toBeNull();
    await tap('refine-option-real-estate');
    expect(shown()).toEqual(['sample-zed', 'sample-ty']);
    expect(screen.getByTestId('refine-industry')).toHaveTextContent('Real estate');
    // Any industry puts everyone back.
    await tap('refine-industry');
    await tap('refine-any');
    expect(shown()).toHaveLength(3);
  });

  it('combines interest, line and business owners, and Clear resets them', async () => {
    await openDirectory();
    await tap('refine-owners');
    expect(shown()).toEqual(['sample-zed', 'sample-ty']);
    await tap('refine-line');
    await tap('refine-option-spring-2019');
    expect(shown()).toEqual(['sample-zed']);
    await tap('refine-interest');
    await tap('refine-option-travel');
    expect(screen.getByTestId('directory-empty')).toHaveTextContent(/Try clearing one/);
    await tap('refine-clear');
    expect(shown()).toHaveLength(3);
    expect(screen.queryByTestId('refine-clear')).toBeNull();
  });

  it('search finds brothers by industry and business too', async () => {
    await openDirectory();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('directory-search'), 'barbershop');
    });
    expect(shown()).toEqual(['sample-ty']);
  });
});

describe('line pages', () => {
  it('tapping Initiated on a profile lists everyone from that line', async () => {
    profile.setMockProfilesFor({
      'sample-zed': profile.sampleProfile({
        displayName: 'Zed Allen',
        headline: 'Broker',
        initiationTerm: 'Spring 2019',
      }),
    });
    await renderRouter('src/app', { initialUrl: '/chapter/member/sample-zed' });
    await waitFor(() => expect(screen.getByTestId('profile-line')).toBeTruthy());
    expect(screen.getByTestId('profile-line')).toHaveTextContent('Initiated Spring 2019');
    await tap('profile-line');
    await waitFor(() => expect(screen).toHavePathname('/chapter/line/Spring 2019'));
    expect(screen.getByRole('header', { name: 'Spring 2019' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('2 BROTHERS')).toBeTruthy());
    expect(screen.getByTestId('line-member-sample-zed')).toBeTruthy();
    expect(screen.getByTestId(`line-member-${me()}`)).toBeTruthy();
    expect(screen.queryByTestId('line-member-sample-ty')).toBeNull();
    // Your own name opens your profile.
    await tap(`line-member-${me()}`);
    await waitFor(() => expect(screen).toHavePathname('/profile'));
  });

  it('says so when no one from the line is in the app', async () => {
    await renderRouter('src/app', { initialUrl: '/chapter/line/Fall%201999' });
    await waitFor(() => expect(screen.getByTestId('line-empty')).toBeTruthy());
  });
});

describe('brother-owned businesses', () => {
  it('opens from Chapter and lists every business A to Z with its owner', async () => {
    await renderRouter('src/app', { initialUrl: '/chapter' });
    await waitFor(() => expect(screen.getByTestId('tile-businesses')).toBeTruthy());
    await tap('tile-businesses');
    await waitFor(() => expect(screen).toHavePathname('/chapter/businesses'));
    await waitFor(() => expect(screen.getByText('2 BUSINESSES')).toBeTruthy());
    expect(screen.getByTestId('business-sample-zed-allen-realty')).toHaveTextContent(
      /Allen Realty.*Zed Allen · Real estate/,
    );
    // You don't own one yet, so it suggests adding yours.
    expect(screen.getByTestId('businesses-add-yours')).toBeTruthy();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('businesses-search'), 'baker');
    });
    expect(screen.queryByTestId('business-sample-zed-allen-realty')).toBeNull();
    await tap('business-sample-ty-baker-barbershop');
    await waitFor(() => expect(screen).toHavePathname('/chapter/member/sample-ty'));
  });

  it('says so when no brother has added a business', async () => {
    directory.resetDirectoryMock([directory.sampleEntry({ uid: me() })]);
    await renderRouter('src/app', { initialUrl: '/chapter/businesses' });
    await waitFor(() => expect(screen.getByTestId('businesses-empty')).toBeTruthy());
  });
});
