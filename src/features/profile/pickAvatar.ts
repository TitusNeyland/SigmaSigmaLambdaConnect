import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Profile photos are stored square at this size, well under the 5 MB Storage limit. */
export const AVATAR_SIZE = 512;

export type AvatarPick =
  { status: 'picked'; uri: string } | { status: 'canceled' } | { status: 'denied' };

/**
 * Lets the member choose a photo, crop it square, and returns a resized JPEG ready to
 * upload. Nothing is uploaded here.
 */
export async function pickAvatar(): Promise<AvatarPick> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return { status: 'canceled' };

  const image = await ImageManipulator.manipulate(result.assets[0].uri)
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { status: 'picked', uri: saved.uri };
}
