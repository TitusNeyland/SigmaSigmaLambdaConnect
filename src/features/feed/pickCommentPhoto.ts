import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Comment photos are stored this wide, well under the 10 MB Storage limit. */
export const COMMENT_PHOTO_WIDTH = 1600;

export type CommentPhotoPick = { status: 'picked'; uri: string } | { status: 'canceled' };

/**
 * Opens the system picker for one photo and returns a resized JPEG ready to upload. It
 * needs no photo library permission, so the app never reads the member's whole camera roll.
 */
export async function pickCommentPhoto(): Promise<CommentPhotoPick> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 1,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return { status: 'canceled' };

  const manip = ImageManipulator.manipulate(asset.uri);
  if (asset.width > COMMENT_PHOTO_WIDTH) manip.resize({ width: COMMENT_PHOTO_WIDTH });
  const image = await manip.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { status: 'picked', uri: saved.uri };
}
