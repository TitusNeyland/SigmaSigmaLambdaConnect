import { Pressable, StyleSheet } from 'react-native';

import { colors, MIN_TOUCH, spacing } from '@/theme';

import { AppText } from './AppText';

export type HeaderButtonProps = {
  title: string;
  onPress: () => void;
  /** The main action, like Done or Save: bold and gold. */
  bold?: boolean;
  disabled?: boolean;
  testID?: string;
};

/** A text button for the left or right of a form's header, like Cancel and Done. */
export function HeaderButton({
  title,
  onPress,
  bold = false,
  disabled = false,
  testID,
}: HeaderButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={spacing.sm}
      style={styles.button}
      testID={testID}
    >
      <AppText
        variant="body"
        weight={bold ? '600' : '400'}
        color={disabled ? colors.textSecondary : bold ? colors.link : colors.text}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: MIN_TOUCH, paddingHorizontal: spacing.sm, justifyContent: 'center' },
});
