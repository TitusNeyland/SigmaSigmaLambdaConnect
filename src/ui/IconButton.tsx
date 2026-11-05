import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, MIN_TOUCH, spacing } from '@/theme';

const ICON = 26;

/** A plain plus, for "new" actions at the top of a screen. */
export function PlusIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path d="M12 4v16M4 12h16" stroke={colors.text} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

export type IconButtonProps = {
  /** What it does, for screen readers, e.g. "New event". */
  label: string;
  onPress: () => void;
  testID?: string;
  children: ReactNode;
};

/** An icon with no text, 44 points square, for the top of a screen. */
export function IconButton({ label, onPress, testID, children }: IconButtonProps) {
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

const styles = StyleSheet.create({
  button: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
