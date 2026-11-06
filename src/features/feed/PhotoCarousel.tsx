import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors, motion, palette, radius, spacing } from '@/theme';

import { useStorageUrl } from './useStorageUrl';

/** Two taps this close together count as a double-tap. */
const DOUBLE_TAP_MS = 300;

function Photo({
  path,
  width,
  height,
  label,
}: {
  path: string;
  width: number;
  height: number;
  label: string;
}) {
  const uri = useStorageUrl(path);
  return (
    <View style={[styles.photo, { width, height }]} testID={`photo-frame-${path}`}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={motion.photoFade}
          accessibilityLabel={label}
          testID={`photo-${path}`}
        />
      ) : null}
    </View>
  );
}

/**
 * Full-width photos you swipe through, with dots when there's more than one. They show at
 * the post's shape, so a wide photo shows wide; posts from before framing are square.
 */
export function PhotoCarousel({
  paths,
  label,
  aspectRatio = 1,
  onDoubleTap,
}: {
  paths: string[];
  label: string;
  /** Width over height. Photos were cropped to it when posted. */
  aspectRatio?: number;
  /** Double-tap a photo to like it. */
  onDoubleTap?: () => void;
}) {
  const lastTap = useRef(0);
  function tap() {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      onDoubleTap?.();
    } else {
      lastTap.current = now;
    }
  }
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  if (paths.length === 0) return null;
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        accessibilityLabel={paths.length > 1 ? `${paths.length} photos` : undefined}
      >
        {paths.map((path, i) => (
          <Pressable key={path} onPress={tap} accessible={false} testID={`photo-tap-${path}`}>
            <Photo
              path={path}
              width={width}
              height={Math.round(width / aspectRatio)}
              label={paths.length > 1 ? `${label}, photo ${i + 1} of ${paths.length}` : label}
            />
          </Pressable>
        ))}
      </ScrollView>
      {paths.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
          {paths.map((path, i) => (
            <View key={path} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { backgroundColor: colors.fill },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, paddingTop: spacing.sm },
  dot: {
    width: spacing.xs + 2,
    height: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: palette.separator,
  },
  dotOn: { backgroundColor: palette.gold },
});
