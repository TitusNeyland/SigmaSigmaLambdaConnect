import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { COMMENT_PHOTO_WIDTH, pickCommentPhoto } from './pickCommentPhoto';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

const saveAsync = jest.fn(async () => ({ uri: 'file:///resized.jpg' }));
const renderAsync = jest.fn(async () => ({ saveAsync }));
const resize = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  resize.mockReturnValue(undefined);
  jest.mocked(ImageManipulator.manipulate).mockReturnValue({ resize, renderAsync } as never);
});

it('picks one photo, resizes wide ones, and never asks for the library', async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///full.jpg', width: 4000, height: 3000 }],
  } as never);
  expect(await pickCommentPhoto()).toEqual({ status: 'picked', uri: 'file:///resized.jpg' });
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({ mediaTypes: 'images' }),
  );
  expect(ImagePicker).not.toHaveProperty('requestMediaLibraryPermissionsAsync');
  expect(resize).toHaveBeenCalledWith({ width: COMMENT_PHOTO_WIDTH });
});

it('leaves a small photo at its size, and treats a cancel as nothing', async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///small.jpg', width: 800, height: 600 }],
  } as never);
  expect(await pickCommentPhoto()).toEqual({ status: 'picked', uri: 'file:///resized.jpg' });
  expect(resize).not.toHaveBeenCalled();

  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: true, assets: [] } as never);
  expect(await pickCommentPhoto()).toEqual({ status: 'canceled' });
});
