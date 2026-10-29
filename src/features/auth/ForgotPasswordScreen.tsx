import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { sendPasswordReset } from '@/data/auth';
import { colors, spacing } from '@/theme';
import { AppText, Button, TextField } from '@/ui';

import { AuthForm } from './AuthForm';
import { friendlyAuthError, normalizeEmail, validateEmail } from './validation';

export function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const problem = validateEmail(email);
    setError(problem);
    setFormError(null);
    if (problem) return;
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setSentTo(normalizeEmail(email));
    } catch (e) {
      setFormError(friendlyAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <AuthForm title="Check your email">
        <AppText variant="callout" color={colors.textSecondary} accessibilityRole="alert">
          If an account uses {sentTo}, a link to reset the password is on its way.
        </AppText>
        <Button title="Send again" variant="secondary" onPress={() => setSentTo(null)} fullWidth />
      </AuthForm>
    );
  }

  return (
    <AuthForm
      title="Reset password"
      subtitle="Enter the email you signed up with and we'll send a reset link."
      formError={formError}
      footer={
        <View style={styles.footer}>
          <Button
            title="Send reset link"
            onPress={submit}
            loading={submitting}
            fullWidth
            testID="reset-submit"
          />
        </View>
      }
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={error}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="send"
        onSubmitEditing={submit}
        testID="reset-email"
      />
    </AuthForm>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.lg },
});
