import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { DraftPhoto } from './draft';

/** Post photos are stored at most this long on their longer side. */
export const MAX_SIDE = 1600;
/** JPEG quality. Keeps a typical photo around 300 to 600 KB, well under the 10 MB limit. */
export const JPEG_QUALITY = 0.8;

/** The size to scale to, keeping the shape. Null when it's already small enough. */
export function targetSize(
  width: number,
  height: number,
): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= MAX_SIDE) return null;
  return width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE };
}

/**
 * Shrinks and compresses a picked photo before upload, so posts work on a weak connection.
 * Always re-encodes as JPEG, which also turns HEIC from iPhones into a format every phone
 * can show.
 */
export async function preparePhoto(photo: DraftPhoto): Promise<string> {
  const manip = ImageManipulator.manipulate(photo.uri);
  const size = targetSize(photo.width, photo.height);
  if (size) manip.resize(size);
  const image = await manip.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return saved.uri;
}
