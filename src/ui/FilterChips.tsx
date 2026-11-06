import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export type FilterOption<T extends string> = { value: T; label: string };

export type FilterChipsProps<T extends string> = {
  options: readonly FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /**
   * "card" for a gray grouped background, where the default gray pills would disappear:
   * white pills with a thin border instead.
   */
  tone?: 'fill' | 'card';
  /**
   * The screen's side padding. The row then scrolls right to the screen's edges instead of
   * cutting pills off at the padding, and still starts lined up with the content.
   */
  inset?: number;
  testID?: string;
};

/** A horizontal row of single-choice filter pills. The selected one is filled black. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  tone = 'fill',
  inset = 0,
  testID,
}: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={inset ? { marginHorizontal: -inset } : undefined}
      contentContainerStyle={[styles.row, inset ? { paddingHorizontal: inset } : null]}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              selected ? styles.selected : tone === 'card' ? styles.card : styles.idle,
            ]}
            testID={testID ? `${testID}-${option.value}` : undefined}
          >
            <AppText variant="subhead" weight="500" color={selected ? palette.onInk : colors.text}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH - spacing.sm,
    paddingHorizontal: spacing.lg - 2,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: palette.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink,
  },
  idle: { backgroundColor: colors.fill },
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
});
