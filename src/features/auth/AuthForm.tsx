import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { AppText } from '@/ui';

export type AuthFormProps = {
  title: string;
  subtitle?: string;
  /** A message for the whole form, e.g. a sign-in failure. */
  formError?: string | null;
  children: ReactNode;
  footer?: ReactNode;
};

/** Shared layout for the sign in and sign up screens. */
export function AuthForm({ title, subtitle, formError, children, footer }: AuthFormProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}>
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="callout" color={colors.textSecondary}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {formError ? (
            <View style={styles.formError} accessibilityRole="alert">
              <AppText variant="subhead" color={colors.destructive}>
                {formError}
              </AppText>
            </View>
          ) : null}
          <View style={styles.fields}>{children}</View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.xl },
  heading: { gap: spacing.xs },
  fields: { gap: spacing.lg },
  formError: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: '#FDECEA',
  },
});
