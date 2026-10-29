import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, MIN_TOUCH, spacing } from '@/theme';

import { AppText } from './AppText';

export type NavHeaderProps = {
  /** Small centered title. Leave out when the screen shows its own large title. */
  title?: string;
  onBack: () => void;
  backTestID?: string;
  /** A button on the right, at least 44 points square, e.g. a More menu. */
  trailing?: ReactNode;
};

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path d="m15 18-6-6 6-6" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** iOS navigation bar for pushed screens: back chevron and an optional centered title. */
export function NavHeader({ title, onBack, backTestID, trailing }: NavHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={spacing.sm}
        style={styles.back}
        testID={backTestID}
      >
        <BackIcon />
      </Pressable>
      {title ? (
        <AppText variant="headline" accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      {trailing ?? <View style={styles.back} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
