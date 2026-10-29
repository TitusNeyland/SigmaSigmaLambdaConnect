import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors, palette, radius, spacing } from '@/theme';

import { useStorageUrl } from './useStorageUrl';

/** Two taps this close together count as a double-tap. */
const DOUBLE_TAP_MS = 300;

function Photo({ path, width, label }: { path: string; width: number; label: string }) {
  const uri = useStorageUrl(path);
  return (
    <View style={[styles.photo, { width }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel={label}
          testID={`photo-${path}`}
        />
      ) : null}
    </View>
  );
}

/** Full-width square photos you swipe through, with dots when there's more than one. */
export function PhotoCarousel({
  paths,
  label,
  onDoubleTap,
}: {
  paths: string[];
  label: string;
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
  photo: { aspectRatio: 1, backgroundColor: colors.fill },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, paddingTop: spacing.sm },
  dot: {
    width: spacing.xs + 2,
    height: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: palette.separator,
  },
  dotOn: { backgroundColor: palette.gold },
});
