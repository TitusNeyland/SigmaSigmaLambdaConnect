import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { subscribeToBlocked, unblock, type BlockedAccount } from '@/data/blocks';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, spacing } from '@/theme';
import { AppText, Avatar, Button, ListRow, ListSection } from '@/ui';

import { SettingsHeader } from './SettingsScreen';

type State =
  { state: 'loading' } | { state: 'ready'; accounts: BlockedAccount[] } | { state: 'error' };

export function BlockedAccountsScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const [result, setResult] = useState<{ uid: string; value: State } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBlocked(
      uid,
      (accounts) => setResult({ uid, value: { state: 'ready', accounts } }),
      () => setResult({ uid, value: { state: 'error' } }),
    );
  }, [uid]);

  const value: State = result && result.uid === uid ? result.value : { state: 'loading' };

  async function doUnblock(account: BlockedAccount) {
    setBusy(account.uid);
    setFailed(null);
    try {
      await unblock(uid, account.uid);
    } catch {
      setFailed(account.displayName);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title="Blocked accounts" />
      <ScrollView contentContainerStyle={styles.content}>
        {value.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : value.state === 'error' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Couldn’t load your blocked accounts.
          </AppText>
        ) : value.accounts.length === 0 ? (
          <View style={styles.empty}>
            <AppText variant="headline" align="center">
              No one is blocked
            </AppText>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Block someone from the menu on their post or profile. They won’t be told.
            </AppText>
          </View>
        ) : (
          <ListSection
            footer={
              failed
                ? `Couldn’t unblock ${failed}. Try again.`
                : 'Blocked brothers’ posts and comments are hidden from you. They aren’t told.'
            }
          >
            {value.accounts.map((account) => (
              <ListRow
                key={account.uid}
                title={account.displayName}
                leading={<Avatar name={account.displayName} uri={account.photoURL} size={36} />}
                trailing={
                  <Button
                    title="Unblock"
                    variant="secondary"
                    size="small"
                    loading={busy === account.uid}
                    onPress={() => doUnblock(account)}
                    accessibilityLabel={`Unblock ${account.displayName}`}
                    testID={`unblock-${account.uid}`}
                  />
                }
                testID={`blocked-${account.uid}`}
              />
            ))}
          </ListSection>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, gap: spacing.xl },
  empty: { paddingTop: spacing.xxxl, gap: spacing.sm },
});
