import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { signUp } from '@/data/auth';
import { colors, spacing } from '@/theme';
import { AppText, Button, TextField, type TextFieldRef } from '@/ui';

import { AuthForm } from './AuthForm';
import {
  friendlyAuthError,
  hasErrors,
  MIN_PASSWORD_LENGTH,
  validateSignUp,
  type FieldErrors,
  type SignUpInput,
} from './validation';

const EMPTY: SignUpInput = { displayName: '', initiationTerm: '', email: '', password: '' };

export function SignUpScreen() {
  const [form, setForm] = useState<SignUpInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<keyof SignUpInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const termRef = useRef<TextFieldRef>(null);
  const emailRef = useRef<TextFieldRef>(null);
  const passwordRef = useRef<TextFieldRef>(null);

  const set = (key: keyof SignUpInput) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    const next = validateSignUp(form);
    setErrors(next);
    setFormError(null);
    if (hasErrors(next)) return;
    setSubmitting(true);
    try {
      await signUp(form);
    } catch (error) {
      setFormError(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthForm
      title="Create account"
      subtitle="An officer approves every new account before you can see chapter content."
      formError={formError}
      footer={
        <View style={styles.footer}>
          <Button
            title="Create account"
            onPress={submit}
            loading={submitting}
            fullWidth
            testID="sign-up-submit"
          />
          <Link href="/sign-in" replace style={styles.link}>
            <AppText variant="callout" color={colors.textSecondary}>
              Have an account?{' '}
              <AppText variant="callout" color={colors.link}>
                Sign in
              </AppText>
            </AppText>
          </Link>
        </View>
      }
    >
      <TextField
        label="Full name"
        value={form.displayName}
        onChangeText={set('displayName')}
        error={errors.displayName}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => termRef.current?.focus()}
        testID="sign-up-name"
      />
      <TextField
        ref={termRef}
        label="Initiated"
        hint="Like Spring 2019"
        placeholder="Spring 2019"
        value={form.initiationTerm}
        onChangeText={set('initiationTerm')}
        error={errors.initiationTerm}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        testID="sign-up-term"
      />
      <TextField
        ref={emailRef}
        label="Email"
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        testID="sign-up-email"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters, with a letter and a number`}
        value={form.password}
        onChangeText={set('password')}
        error={errors.password}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        testID="sign-up-password"
      />
    </AuthForm>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.lg, alignItems: 'center' },
  link: { paddingVertical: spacing.sm },
});
