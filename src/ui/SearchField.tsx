import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, MIN_TOUCH, palette, radius, spacing, type } from '@/theme';

export type SearchFieldProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  /** Read by screen readers and shown as the placeholder. */
  label: string;
  testID?: string;
};

/** iOS-style search bar: gray rounded field with a magnifier and a clear button. */
export function SearchField({ value, onChangeText, label, testID, ...rest }: SearchFieldProps) {
  return (
    <View style={styles.field}>
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
        <Circle cx={11} cy={11} r={7} stroke={palette.secondary} strokeWidth={2} />
        <Path d="m20 20-3.5-3.5" stroke={palette.secondary} strokeWidth={2} strokeLinecap="round" />
      </Svg>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        accessibilityLabel={label}
        placeholderTextColor={palette.secondary}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="never"
        style={styles.input}
        testID={testID}
        {...rest}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={spacing.sm}
          style={styles.clear}
          testID={testID ? `${testID}-clear` : undefined}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" accessibilityElementsHidden>
            <Circle cx={12} cy={12} r={10} fill={palette.tertiary} />
            <Path
              d="M8.5 8.5l7 7M15.5 8.5l-7 7"
              stroke={palette.onInk}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH - spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
  },
  input: { flex: 1, ...type.body, color: colors.text, paddingVertical: spacing.sm },
  clear: { minHeight: MIN_TOUCH - spacing.xs, justifyContent: 'center' },
});
