import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { AVATAR_SIZE, pickAvatar } from './pickAvatar';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockSaveAsync = jest.fn();
const mockRenderAsync = jest.fn(async () => ({ saveAsync: mockSaveAsync }));
const mockResize = jest.fn(() => ({ renderAsync: mockRenderAsync }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn(() => ({ resize: mockResize })) },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
    granted: true,
  } as never);
  mockSaveAsync.mockResolvedValue({ uri: 'file:///resized.jpg', width: 512, height: 512 });
});

it('returns denied without opening the picker when photo access is refused', async () => {
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
    granted: false,
  } as never);
  await expect(pickAvatar()).resolves.toEqual({ status: 'denied' });
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});

it('returns canceled when the member backs out', async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: true,
    assets: null,
  } as never);
  await expect(pickAvatar()).resolves.toEqual({ status: 'canceled' });
  expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
});

it('opens the library with a square crop', async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: true,
    assets: null,
  } as never);
  await pickAvatar();
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1] }),
  );
});

it('resizes the cropped photo to a small square JPEG', async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///original.heic' }],
  } as never);
  await expect(pickAvatar()).resolves.toEqual({ status: 'picked', uri: 'file:///resized.jpg' });
  expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///original.heic');
  expect(mockResize).toHaveBeenCalledWith({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  expect(mockSaveAsync).toHaveBeenCalledWith({ format: SaveFormat.JPEG, compress: 0.8 });
});
