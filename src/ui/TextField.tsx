import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, MIN_TOUCH, palette, radius, spacing, type } from '@/theme';

import { AppText } from './AppText';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  hint?: string;
  /** Shows a Show/Hide button for passwords. */
  secure?: boolean;
  testID?: string;
};

export type TextFieldRef = ComponentRef<typeof TextInput>;

/** Labeled text input with an inline error, styled like an iOS form field. */
export const TextField = forwardRef<TextFieldRef, TextFieldProps>(function TextField(
  { label, error, hint, secure = false, testID, ...inputProps },
  ref,
) {
  const [hidden, setHidden] = useState(secure);

  return (
    <View style={styles.wrap}>
      <AppText variant="footnote" weight="600" color={colors.textSecondary}>
        {label}
      </AppText>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={palette.tertiary}
          secureTextEntry={hidden}
          style={styles.input}
          testID={testID}
          {...inputProps}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hidden ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`
            }
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            style={styles.toggle}
          >
            <AppText variant="subhead" weight="600" color={colors.link}>
              {hidden ? 'Show' : 'Hide'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="footnote" color={colors.destructive} accessibilityRole="alert">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="footnote" color={colors.textSecondary}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs + 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH + 6,
    borderRadius: radius.md + 2,
    backgroundColor: palette.fill,
    paddingHorizontal: spacing.md + 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fieldError: {
    borderColor: palette.destructive,
  },
  input: {
    flex: 1,
    ...type.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  toggle: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
});
