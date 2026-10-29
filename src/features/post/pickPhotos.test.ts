import * as ImagePicker from 'expo-image-picker';

import { pickFromLibrary, takePhoto } from './pickPhotos';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

const asset = (n: number) => ({ uri: `file:///${n}.jpg`, width: 4000, height: 3000 });

beforeEach(() => jest.clearAllMocks());

describe('pickFromLibrary', () => {
  it('opens the system picker with numbered multi-select up to what’s left', async () => {
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue({ canceled: false, assets: [asset(1), asset(2)] } as never);
    expect(await pickFromLibrary(7)).toEqual({
      status: 'picked',
      photos: [
        { uri: 'file:///1.jpg', width: 4000, height: 3000 },
        { uri: 'file:///2.jpg', width: 4000, height: 3000 },
      ],
    });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsMultipleSelection: true,
        selectionLimit: 7,
        orderedSelection: true,
        mediaTypes: 'images',
      }),
    );
  });

  it('never asks for photo library permission', async () => {
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue({ canceled: true, assets: null } as never);
    expect(await pickFromLibrary(10)).toEqual({ status: 'canceled' });
    expect(ImagePicker).not.toHaveProperty('requestMediaLibraryPermissionsAsync');
  });

  it('doesn’t open when the post is full, and trims extras', async () => {
    expect(await pickFromLibrary(0)).toEqual({ status: 'canceled' });
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue({ canceled: false, assets: [asset(1), asset(2), asset(3)] } as never);
    const pick = await pickFromLibrary(2);
    expect(pick.status === 'picked' && pick.photos).toHaveLength(2);
  });
});

describe('takePhoto', () => {
  it('asks for the camera, then returns one photo', async () => {
    jest
      .mocked(ImagePicker.requestCameraPermissionsAsync)
      .mockResolvedValue({ granted: true } as never);
    jest
      .mocked(ImagePicker.launchCameraAsync)
      .mockResolvedValue({ canceled: false, assets: [asset(5)] } as never);
    expect(await takePhoto()).toMatchObject({
      status: 'picked',
      photos: [{ uri: 'file:///5.jpg' }],
    });
  });

  it('respects a no', async () => {
    jest
      .mocked(ImagePicker.requestCameraPermissionsAsync)
      .mockResolvedValue({ granted: false } as never);
    expect(await takePhoto()).toEqual({ status: 'denied' });
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });
});
