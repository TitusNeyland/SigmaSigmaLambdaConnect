import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
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
jest.mock('./pickPhotos', () => ({ pickFromLibrary: jest.fn(), takePhoto: jest.fn() }));
const picker = jest.requireMock<typeof import('./pickPhotos')>('./pickPhotos');

const photos = (...ns: number[]) =>
  ns.map((n) => ({ uri: `file:///${n}.jpg`, width: 1000, height: 1000 }));

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  auth.setMockUser(auth.sampleUser());
});

async function openPicker() {
  await renderRouter('src/app', { initialUrl: '/new-post' });
  await waitFor(() => expect(screen.getByRole('header', { name: 'New post' })).toBeTruthy());
}

const next = () => screen.getByTestId('post-next');
const numbers = () =>
  screen.queryAllByTestId(/^thumb-\d+$/).map((t) => String(t.props.testID).replace('thumb-', ''));

it('starts with Next disabled and offers photos, camera and text only', async () => {
  await openPicker();
  expect(next().props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByTestId('post-choose')).toBeTruthy();
  expect(screen.getByTestId('post-camera')).toBeTruthy();
  expect(screen.getByTestId('post-text-only')).toBeTruthy();
});

it('picks several photos, numbers them in order and previews the first', async () => {
  jest
    .mocked(picker.pickFromLibrary)
    .mockResolvedValue({ status: 'picked', photos: photos(1, 2, 3) });
  await openPicker();
  await press(screen.getByTestId('post-choose'));
  expect(picker.pickFromLibrary).toHaveBeenCalledWith(10);
  expect(numbers()).toEqual(['1', '2', '3']);
  expect(screen.getByTestId('post-count')).toHaveTextContent('3 of 10');
  expect(JSON.stringify(screen.getByTestId('post-preview').props.source)).toContain('1.jpg');
  expect(next().props.accessibilityState).toMatchObject({ disabled: false });
});

it('previews a tapped photo', async () => {
  jest.mocked(picker.pickFromLibrary).mockResolvedValue({ status: 'picked', photos: photos(1, 2) });
  await openPicker();
  await press(screen.getByTestId('post-choose'));
  await press(screen.getByTestId('thumb-2'));
  expect(JSON.stringify(screen.getByTestId('post-preview').props.source)).toContain('2.jpg');
  expect(screen.getByTestId('thumb-2').props.accessibilityState).toMatchObject({ selected: true });
});

it('adds more only up to what’s left, and stops at 10', async () => {
  jest
    .mocked(picker.pickFromLibrary)
    .mockResolvedValueOnce({ status: 'picked', photos: photos(1, 2, 3, 4, 5, 6, 7) })
    .mockResolvedValueOnce({ status: 'picked', photos: photos(8, 9, 10) });
  await openPicker();
  await press(screen.getByTestId('post-choose'));
  await press(screen.getByTestId('post-add-more'));
  expect(picker.pickFromLibrary).toHaveBeenLastCalledWith(3);
  expect(numbers()).toHaveLength(10);
  expect(screen.getByTestId('post-add-more').props.accessibilityState).toMatchObject({
    disabled: true,
  });
});

it('removes a photo and renumbers, and Next turns off again when none are left', async () => {
  jest.mocked(picker.pickFromLibrary).mockResolvedValue({ status: 'picked', photos: photos(1, 2) });
  await openPicker();
  await press(screen.getByTestId('post-choose'));
  await press(screen.getByRole('button', { name: 'Remove photo 1' }));
  expect(numbers()).toEqual(['1']);
  expect(JSON.stringify(screen.getByTestId('post-preview').props.source)).toContain('2.jpg');
  await press(screen.getByRole('button', { name: 'Remove photo 1' }));
  expect(next().props.accessibilityState).toMatchObject({ disabled: true });
});

it('takes a photo with the camera, and explains when the camera is off', async () => {
  jest.mocked(picker.takePhoto).mockResolvedValueOnce({ status: 'denied' });
  await openPicker();
  await press(screen.getByTestId('post-camera'));
  expect(screen.getByText('Allow camera access in Settings to take a photo.')).toBeTruthy();
  jest.mocked(picker.takePhoto).mockResolvedValueOnce({ status: 'picked', photos: photos(9) });
  await press(screen.getByTestId('post-camera'));
  expect(numbers()).toEqual(['1']);
});

it('canceling the picker changes nothing', async () => {
  jest.mocked(picker.pickFromLibrary).mockResolvedValue({ status: 'canceled' });
  await openPicker();
  await press(screen.getByTestId('post-choose'));
  expect(numbers()).toEqual([]);
  expect(next().props.accessibilityState).toMatchObject({ disabled: true });
});

it('Next goes on to the caption, and text only skips photos', async () => {
  jest.mocked(picker.pickFromLibrary).mockResolvedValue({ status: 'picked', photos: photos(1) });
  await openPicker();
  await press(screen.getByTestId('post-choose'));
  await press(next());
  await waitFor(() => expect(screen).toHavePathname('/new-post/compose'));

  await openPicker();
  await press(screen.getByTestId('post-text-only'));
  await waitFor(() => expect(screen).toHavePathname('/new-post/compose'));
});
