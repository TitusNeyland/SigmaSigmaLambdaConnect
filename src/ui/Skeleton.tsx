import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';

import { colors, radius as radii } from '@/theme';

/** One pulse, dim to bright and back, in milliseconds. */
const PULSE_MS = 900;

/**
 * Gray placeholder shapes that stand in for content while it loads, gently pulsing (held
 * still when the person turned on Reduce Motion). Screen readers hear the label once,
 * instead of every shape.
 */
export function SkeletonGroup({
  label,
  children,
  style,
  testID,
}: {
  /** What's loading, read aloud: "Loading posts". */
  label: string;
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!live || reduce) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.5, duration: PULSE_MS, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
          ]),
        );
        loop.start();
      });
    return () => {
      live = false;
      loop?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[style, { opacity }]}
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}

/** One gray block: a line of text, a photo, an avatar. */
export function Skeleton({
  width = '100%',
  height,
  round = false,
  radius = radii.sm,
  style,
}: {
  width?: DimensionValue;
  /** Leave out when the style sets the shape, like an aspect ratio. */
  height?: DimensionValue;
  /** A circle, for avatars. */
  round?: boolean;
  radius?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[styles.block, { width, height, borderRadius: round ? radii.pill : radius }, style]}
    />
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.fill },
});
