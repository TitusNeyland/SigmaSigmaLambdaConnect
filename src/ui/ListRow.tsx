import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, MIN_TOUCH, palette, spacing } from '@/theme';

import { AppText } from './AppText';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

export function Chevron() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path d="m9 18 6-6-6-6" stroke={palette.tertiary} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

/** One row in a grouped list. Tappable when onPress is set. */
export function ListRow({
  title,
  subtitle,
  value,
  leading,
  trailing,
  onPress,
  destructive = false,
  showChevron,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const chevron = showChevron ?? (!!onPress && !destructive && !trailing);
  const label = [title, subtitle, value].filter(Boolean).join(', ');

  const content = (
    <>
      {leading}
      <View style={styles.text}>
        <AppText color={destructive ? colors.destructive : colors.text}>{title}</AppText>
        {subtitle ? (
          <AppText variant="footnote" color={colors.textSecondary}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="callout" color={colors.textSecondary} numberOfLines={1}>
          {value}
        </AppText>
      ) : null}
      {trailing}
      {chevron ? <Chevron /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} testID={testID} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export type SwitchRowProps = {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

/** A list row with an iOS switch. Uses ink for the on state. */
export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
  testID,
}: SwitchRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText>{title}</AppText>
        {subtitle ? (
          <AppText variant="footnote" color={colors.textSecondary}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: palette.separator, true: palette.ink }}
        thumbColor={palette.onInk}
        ios_backgroundColor={palette.separator}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  pressed: {
    backgroundColor: colors.fill,
  },
});
