import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { signIn } from '@/data/auth';
import { colors, spacing } from '@/theme';
import { AppText, Button, TextField, type TextFieldRef } from '@/ui';

import { AuthForm } from './AuthForm';
import { friendlyAuthError, hasErrors, validateSignIn, type FieldErrors } from './validation';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextFieldRef>(null);

  async function submit() {
    const next = validateSignIn({ email, password });
    setErrors(next);
    setFormError(null);
    if (hasErrors(next)) return;
    setSubmitting(true);
    try {
      await signIn(email, password);
      // The auth listener moves the app forward once sign in succeeds.
    } catch (error) {
      setFormError(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthForm
      title="Sign in"
      subtitle="Welcome back to Sigma Sigma Lambda."
      formError={formError}
      footer={
        <View style={styles.footer}>
          <Button
            title="Sign in"
            onPress={submit}
            loading={submitting}
            fullWidth
            testID="sign-in-submit"
          />
          <Link href="/sign-up" replace style={styles.link}>
            <AppText variant="callout" color={colors.textSecondary}>
              New here?{' '}
              <AppText variant="callout" color={colors.link}>
                Create an account
              </AppText>
            </AppText>
          </Link>
        </View>
      }
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        testID="sign-in-email"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secure
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        testID="sign-in-password"
      />
    </AuthForm>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.lg, alignItems: 'center' },
  link: { paddingVertical: spacing.sm },
});
