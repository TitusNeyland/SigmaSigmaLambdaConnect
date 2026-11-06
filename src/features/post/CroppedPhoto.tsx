import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

import { centerCrop, cropPlacement } from './cropLogic';
import type { DraftPhoto } from './draft';

/**
 * A picked photo as it will be posted: at the post's shape, showing just the part the member
 * framed (the middle, if they didn't), the same crop preparePhoto uploads.
 */
export function CroppedPhoto({
  photo,
  aspect,
  height,
  style,
  testID,
}: {
  photo: DraftPhoto;
  /** The post's shape, width over height. */
  aspect: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const box = { width: Math.round(height * aspect), height };
  const placed = cropPlacement(photo.crop ?? centerCrop(photo, aspect), box);
  return (
    <View style={[styles.box, box, style]} testID={testID}>
      <Image
        source={{ uri: photo.uri }}
        contentFit="fill"
        style={[styles.photo, placed]}
        testID={testID ? `${testID}-image` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: colors.fill },
  photo: { position: 'absolute' },
});
