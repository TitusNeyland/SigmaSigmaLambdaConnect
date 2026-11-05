import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { NEW_POST_ROUTE } from '@/features/navigation/TabLayout';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { Monogram } from '@/ui';

const ICON = 26;
const DOT = 8;

function PlusIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path d="M12 4v16M4 12h16" stroke={colors.text} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

function HeartIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.4 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.6 0 5.5 3.7 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
        stroke={colors.text}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconButton({
  label,
  onPress,
  testID,
  children,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

/**
 * Home's top bar, Instagram style: new post on the left, the ΣΣΛ monogram in the middle,
 * and Activity on the right with a dot when there's something new.
 */
export function HomeHeader({ hasNew }: { hasNew: boolean }) {
  return (
    <View>
      <View style={styles.bar}>
        <IconButton
          label="Create a post"
          onPress={() => router.push(NEW_POST_ROUTE)}
          testID="home-new-post"
        >
          <PlusIcon />
        </IconButton>
        <View accessible accessibilityRole="header" accessibilityLabel="Sigma Sigma Lambda">
          <Monogram size={34} />
        </View>
        <IconButton
          label={hasNew ? 'Activity, new' : 'Activity'}
          onPress={() => router.push('/home/activity')}
          testID="home-activity"
        >
          <HeartIcon />
          {hasNew ? <View style={styles.dot} testID="home-activity-dot" /> : null}
        </IconButton>
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  button: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  dot: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.destructive,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
});
