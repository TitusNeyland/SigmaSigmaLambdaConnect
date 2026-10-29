import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Event photos are stored this wide, well under the 10 MB Storage limit. */
export const EVENT_PHOTO_WIDTH = 1600;

export type EventPhotoPick =
  { status: 'picked'; uri: string } | { status: 'canceled' } | { status: 'denied' };

/** Lets an officer choose a photo and returns a resized JPEG ready to upload. */
export async function pickEventPhoto(): Promise<EventPhotoPick> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return { status: 'canceled' };

  const manip = ImageManipulator.manipulate(asset.uri);
  if (asset.width > EVENT_PHOTO_WIDTH) manip.resize({ width: EVENT_PHOTO_WIDTH });
  const image = await manip.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { status: 'picked', uri: saved.uri };
}
