import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { decideRequest, fetchPendingRequests, type MembershipRequest } from '@/data/requests';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, radius, spacing } from '@/theme';
import { AppText, Button, NavHeader } from '@/ui';

import { RequestRow } from './RequestRow';

type Loaded =
  { state: 'loading' } | { state: 'error' } | { state: 'ready'; requests: MembershipRequest[] };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter/leadership');
}

/** Every pending sign-up, with Approve and Decline on each. Officers only. */
export function RequestsScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const canApprove = useCan('members.approve');
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      if (!canApprove) return;
      let live = true;
      fetchPendingRequests().then(
        (requests) => {
          if (!live) return;
          setNow(new Date());
          setLoaded({ state: 'ready', requests });
        },
        () => live && setLoaded({ state: 'error' }),
      );
      return () => {
        live = false;
      };
      // attempt isn't read; bumping it is how Try again reloads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canApprove, attempt]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="requests-back" />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Membership requests
        </AppText>
        {!canApprove ? (
          <AppText variant="callout" color={colors.textSecondary} testID="requests-denied">
            Only officers can see this.
          </AppText>
        ) : loaded.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : loaded.state === 'error' ? (
          <View style={styles.center}>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Couldn’t load requests.
            </AppText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setLoaded({ state: 'loading' });
                setAttempt((n) => n + 1);
              }}
              testID="requests-retry"
            />
          </View>
        ) : loaded.requests.length === 0 ? (
          <AppText
            variant="callout"
            color={colors.textSecondary}
            align="center"
            testID="requests-empty"
          >
            No one is waiting. New sign-ups show up here.
          </AppText>
        ) : (
          <>
            <AppText variant="footnote" color={colors.textSecondary}>
              Approve brothers you know are members of the chapter. Approving lets them see
              everything in the app.
            </AppText>
            <View style={styles.list}>
              {loaded.requests.map((r) => (
                <RequestRow
                  key={r.uid}
                  request={r}
                  now={now}
                  onDecide={(d) => decideRequest(r.uid, uid, d)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },
  center: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  list: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    gap: 1,
    backgroundColor: colors.separator,
  },
});
