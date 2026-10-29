import * as ImagePicker from 'expo-image-picker';

import type { DraftPhoto } from './draft';

export type PhotoPick =
  { status: 'picked'; photos: DraftPhoto[] } | { status: 'canceled' } | { status: 'denied' };

const toPhotos = (assets: ImagePicker.ImagePickerAsset[]): DraftPhoto[] =>
  assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));

/**
 * Opens the system photo picker with numbered, ordered multi-select. It needs no photo
 * library permission, so the app never reads the member's whole camera roll.
 */
export async function pickFromLibrary(limit: number): Promise<PhotoPick> {
  if (limit <= 0) return { status: 'canceled' };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'canceled' };
  return { status: 'picked', photos: toPhotos(result.assets).slice(0, limit) };
}

/** Takes one photo with the camera. Asks for camera permission the first time. */
export async function takePhoto(): Promise<PhotoPick> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
  if (result.canceled || result.assets.length === 0) return { status: 'canceled' };
  return { status: 'picked', photos: toPhotos(result.assets.slice(0, 1)) };
}
