import { Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH, palette, radius } from '@/theme';

import { AppText } from './AppText';

export type Segment<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  segments: readonly Segment<T>[];
  /** Null when nothing is chosen yet, like an RSVP not given. */
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** Shows the current choice but can't be changed, like an RSVP after its deadline. */
  disabled?: boolean;
  testID?: string;
};

/** iOS-style segmented control: gray track, white thumb on the selected segment. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View
      style={styles.track}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={segment.label}
            disabled={disabled}
            onPress={() => {
              if (!selected) onChange(segment.value);
            }}
            hitSlop={{ top: 2, bottom: 2 }}
            style={[styles.segment, selected && styles.selected]}
            testID={testID ? `${testID}-${segment.value}` : undefined}
          >
            <AppText
              variant="subhead"
              weight={selected ? '600' : '500'}
              color={disabled && !selected ? colors.textSecondary : colors.text}
            >
              {segment.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: palette.segmentTrack,
    borderRadius: radius.md - 1,
    padding: 2,
  },
  segment: {
    flex: 1,
    // With the track's padding and hitSlop, each segment is a 44 point touch target.
    minHeight: MIN_TOUCH - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  selected: {
    backgroundColor: palette.bg,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
