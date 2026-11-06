import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resendVerificationEmail } from '@/data/auth';
import { signOutHere } from './signOut';
import { colors, radius, spacing } from '@/theme';
import { AppText, Button } from '@/ui';

import { useAuth } from './AuthProvider';
import { journey, OnboardingArt, OnboardingSteps } from './OnboardingArt';
import { friendlyAuthError } from './validation';

export const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailScreen() {
  const { user, refresh } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Check again whenever the app comes back to the front, e.g. after tapping the link.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function checkNow() {
    setChecking(true);
    setMessage(null);
    try {
      const status = await refresh();
      if (status === 'unverified') {
        setMessage('Not verified yet. Tap the link in the email, then try again.');
      }
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setChecking(false);
    }
  }

  async function resend() {
    setMessage(null);
    try {
      await resendVerificationEmail();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage('Sent. Check your inbox and spam folder.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    }
  }

  // iOS can open the Mail app's inbox. Android has no one inbox to open.
  const canOpenMail = Platform.OS === 'ios';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <OnboardingArt name="mail" size={112} />
        <AppText variant="title" align="center" accessibilityRole="header">
          Check your email
        </AppText>
        <AppText variant="callout" color={colors.textSecondary} align="center">
          We sent a link to{' '}
          <AppText variant="callout" weight="600">
            {user?.email ?? 'your email'}
          </AppText>
          . Tap it to verify your account, then come back here.
        </AppText>
        {message ? (
          <AppText
            variant="subhead"
            align="center"
            color={colors.textSecondary}
            accessibilityRole="alert"
          >
            {message}
          </AppText>
        ) : null}
        <View style={styles.card}>
          <OnboardingSteps steps={journey('verify')} testID="verify-steps" />
        </View>
      </ScrollView>
      <View style={styles.actions}>
        {canOpenMail ? (
          <Button
            title="Open Mail"
            onPress={() => Linking.openURL('message://').catch(() => {})}
            fullWidth
            testID="verify-open-mail"
          />
        ) : null}
        <Button
          title="I've verified my email"
          variant={canOpenMail ? 'secondary' : 'primary'}
          onPress={checkNow}
          loading={checking}
          fullWidth
          testID="verify-check"
        />
        <Button
          title={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          variant="plain"
          onPress={resend}
          disabled={cooldown > 0}
          fullWidth
          testID="verify-resend"
        />
        <Button title="Use a different account" variant="plain" onPress={() => signOutHere()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  card: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 0,
    borderRadius: radius.xl,
    backgroundColor: colors.backgroundGrouped,
  },
  actions: { gap: spacing.sm },
});
