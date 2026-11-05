import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { JPEG_QUALITY, MAX_SIDE, preparePhoto, targetSize } from './preparePhoto';

const mockResize = jest.fn();
const mockCrop = jest.fn();
const mockSave = jest.fn(async () => ({ uri: 'file:///small.jpg' }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      crop: mockCrop,
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

it('keeps the whole photo when the frame matches it, then resizes and saves a JPEG', async () => {
  expect(
    await preparePhoto({ uri: 'file:///big.heic', width: 4032, height: 3024 }, 4032 / 3024),
  ).toBe('file:///small.jpg');
  expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///big.heic');
  expect(mockCrop).toHaveBeenCalledWith({ originX: 0, originY: 0, width: 4032, height: 3024 });
  expect(mockResize).toHaveBeenCalledWith({ width: 1600 });
  expect(mockSave).toHaveBeenCalledWith({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
});

it('crops an unedited photo to the middle at the post’s shape', async () => {
  // A 16:9 photo in a square post keeps its middle square.
  await preparePhoto({ uri: 'file:///wide.jpg', width: 1920, height: 1080 }, 1);
  expect(mockCrop).toHaveBeenCalledWith({ originX: 420, originY: 0, width: 1080, height: 1080 });
  expect(mockResize).not.toHaveBeenCalled();
});

it('crops to how the member framed it, and sizes by the crop', async () => {
  await preparePhoto(
    {
      uri: 'file:///big.jpg',
      width: 4000,
      height: 3000,
      crop: { x: 0.5, y: 0.5, width: 0.25, height: 0.25 },
    },
    4 / 3,
  );
  expect(mockCrop).toHaveBeenCalledWith({ originX: 2000, originY: 1500, width: 1000, height: 750 });
  // 1000 wide is already under 1600: no resize.
  expect(mockResize).not.toHaveBeenCalled();
});

it('still re-encodes a small photo as JPEG, without resizing', async () => {
  await preparePhoto({ uri: 'file:///small.png', width: 800, height: 600 }, 800 / 600);
  expect(mockResize).not.toHaveBeenCalled();
  expect(mockSave).toHaveBeenCalled();
});
