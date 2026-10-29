import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export type FilterOption<T extends string> = { value: T; label: string };

export type FilterChipsProps<T extends string> = {
  options: readonly FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  testID?: string;
};

/** A horizontal row of single-choice filter pills. The selected one is filled black. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
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
            style={[styles.chip, selected ? styles.selected : styles.idle]}
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
  selected: { backgroundColor: palette.ink },
  idle: { backgroundColor: colors.fill },
});
