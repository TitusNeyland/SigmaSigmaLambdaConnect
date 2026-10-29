import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'plain';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'regular' | 'small';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
};

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: palette.ink, fg: palette.onInk },
  secondary: { bg: palette.fill, fg: palette.ink },
  destructive: { bg: palette.destructive, fg: palette.onInk },
  plain: { bg: 'transparent', fg: palette.goldText },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'regular',
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  testID,
  style,
}: ButtonProps) {
  const { bg, fg } = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      hitSlop={size === 'small' ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        size === 'small' ? styles.small : styles.regular,
        { backgroundColor: bg },
        fullWidth && styles.fullWidth,
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={fg} testID={testID ? `${testID}-spinner` : undefined} />
        ) : null}
        <AppText variant={size === 'small' ? 'subhead' : 'body'} weight="600" color={fg}>
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  regular: {
    minHeight: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  small: {
    minHeight: 34,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH - 10,
  },
  pressed: {
    opacity: 0.8,
  },
  inactive: {
    opacity: 0.45,
  },
});

export const buttonColors = VARIANTS;
export const BUTTON_TEXT = colors.textOnInk;
