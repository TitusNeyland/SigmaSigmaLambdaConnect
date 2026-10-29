import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { acceptGuidelines } from '@/data/profile';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/useProfileData';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { AppText, Button, HeaderButton } from '@/ui';

import { GuidelinesContent } from './GuidelinesContent';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

/**
 * Shows the guidelines and asks the member to agree before their first post. Once they
 * have, it shows its children. The rules refuse posts without an acceptance too.
 */
export function GuidelinesGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const profile = useProfile(uid, { own: true });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  if (profile.state === 'ready' && profile.data?.guidelinesAccepted) return <>{children}</>;

  async function agree() {
    setSaving(true);
    setFailed(false);
    try {
      await acceptGuidelines(uid);
      // The profile listener picks up the new timestamp and opens the gate.
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HeaderButton title="Cancel" onPress={close} testID="guidelines-cancel" />
        <AppText variant="headline" accessibilityRole="header">
          Before you post
        </AppText>
        <View style={styles.side} />
      </View>
      {profile.state === 'loading' ? (
        <View style={styles.center}>
          <AppText variant="callout" color={colors.textSecondary}>
            Loading…
          </AppText>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <GuidelinesContent />
          </ScrollView>
          <View style={styles.footer}>
            {failed || profile.state === 'error' ? (
              <AppText variant="footnote" color={colors.destructive} align="center">
                Couldn’t save that. Check your connection and try again.
              </AppText>
            ) : null}
            <Button
              title="I agree"
              onPress={agree}
              loading={saving}
              disabled={profile.state !== 'ready'}
              fullWidth
              testID="guidelines-agree"
            />
            <AppText variant="caption" color={colors.textSecondary} align="center">
              You can read these again any time in Settings.
            </AppText>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  side: { width: MIN_TOUCH * 1.5 },
  content: { padding: spacing.xl },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
