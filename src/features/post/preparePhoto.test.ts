import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { JPEG_QUALITY, MAX_SIDE, preparePhoto, targetSize } from './preparePhoto';

const mockResize = jest.fn();
const mockSave = jest.fn(async () => ({ uri: 'file:///small.jpg' }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: mockResize,
      renderAsync: async () => ({ saveAsync: mockSave }),
    })),
  },
}));

beforeEach(() => jest.clearAllMocks());

it('scales the longer side down to 1600 and leaves small photos alone', () => {
  expect(MAX_SIDE).toBe(1600);
  expect(targetSize(4032, 3024)).toEqual({ width: 1600 });
  expect(targetSize(3024, 4032)).toEqual({ height: 1600 });
  expect(targetSize(1600, 1200)).toBeNull();
});

it('resizes a big photo and saves a compressed JPEG', async () => {
  expect(await preparePhoto({ uri: 'file:///big.heic', width: 4032, height: 3024 })).toBe(
    'file:///small.jpg',
  );
  expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///big.heic');
  expect(mockResize).toHaveBeenCalledWith({ width: 1600 });
  expect(mockSave).toHaveBeenCalledWith({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
});

it('still re-encodes a small photo as JPEG, without resizing', async () => {
  await preparePhoto({ uri: 'file:///small.png', width: 800, height: 600 });
  expect(mockResize).not.toHaveBeenCalled();
  expect(mockSave).toHaveBeenCalled();
});
