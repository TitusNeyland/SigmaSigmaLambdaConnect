import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resendVerificationEmail } from '@/data/auth';
import { signOutHere } from './signOut';
import { colors, palette, spacing } from '@/theme';
import { AppText, Button } from '@/ui';

import { useAuth } from './AuthProvider';
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <AppText variant="title" color={palette.goldText}>
            @
          </AppText>
        </View>
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
      </View>
      <View style={styles.actions}>
        <Button
          title="I've verified my email"
          onPress={checkNow}
          loading={checking}
          fullWidth
          testID="verify-check"
        />
        <Button
          title={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          variant="secondary"
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
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: spacing.md },
});
