import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchAllReports,
  fetchMyReports,
  fetchRecipients,
  type CommitteeReport,
} from '@/data/committeeReports';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, spacing } from '@/theme';
import { AppText, Button, ListRow, ListSection, NavHeader, StatusChip } from '@/ui';

import { emailStatus, reportTitle, shortDate } from './reportLogic';

type Loaded =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; reports: CommitteeReport[]; recipients: number | null; now: Date };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter');
}

/**
 * Documents: committee reports. Anyone approved submits one and sees their own; officers
 * see every report; admins set who they're emailed to.
 */
export function DocumentsScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const seeAll = useCan('committeeReports.review');
  const setRecipients = useCan('committeeReports.recipients');
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let live = true;
      Promise.all([
        seeAll ? fetchAllReports() : fetchMyReports(uid),
        setRecipients ? fetchRecipients().then((r) => r.length) : Promise.resolve(null),
      ]).then(
        ([reports, recipients]) =>
          live && setLoaded({ state: 'ready', reports, recipients, now: new Date() }),
        () => live && setLoaded({ state: 'error' }),
      );
      return () => {
        live = false;
      };
      // attempt isn't read; bumping it is how Try again reloads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, seeAll, setRecipients, attempt]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="documents-back" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <AppText variant="largeTitle" accessibilityRole="header">
            Documents
          </AppText>
          <AppText variant="subhead" color={colors.textSecondary}>
            Committee reports go to the chapter’s VPs by email.
          </AppText>
        </View>

        <Button
          title="Submit a committee report"
          onPress={() => router.push('/chapter/documents/new')}
          fullWidth
          testID="submit-report"
        />

        {loaded.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : loaded.state === 'error' ? (
          <View style={styles.center}>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Couldn’t load reports.
            </AppText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setLoaded({ state: 'loading' });
                setAttempt((n) => n + 1);
              }}
              testID="documents-retry"
            />
          </View>
        ) : (
          <>
            <ListSection header={seeAll ? 'All reports' : 'Your reports'} testID="reports-list">
              {loaded.reports.length === 0 ? (
                <ListRow
                  title={seeAll ? 'No reports yet' : 'You haven’t sent a report yet'}
                  testID="reports-empty"
                />
              ) : (
                loaded.reports.map((r) => {
                  const status = emailStatus(r);
                  return (
                    <ListRow
                      key={r.id}
                      title={reportTitle(r)}
                      subtitle={[
                        seeAll ? (r.authorName ?? 'A brother') : null,
                        shortDate(r.createdAt, loaded.now),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      trailing={<StatusChip label={status.label} tone={status.tone} />}
                      showChevron
                      onPress={() =>
                        router.push({ pathname: '/chapter/documents/[id]', params: { id: r.id } })
                      }
                      testID={`report-${r.id}`}
                    />
                  );
                })
              )}
            </ListSection>

            {loaded.recipients !== null ? (
              <ListSection
                header="Email"
                footer={
                  loaded.recipients === 0
                    ? 'No one gets reports by email until you add addresses.'
                    : undefined
                }
              >
                <ListRow
                  title="Report recipients"
                  subtitle="Who committee reports are emailed to"
                  value={loaded.recipients === 0 ? 'None' : String(loaded.recipients)}
                  onPress={() => router.push('/chapter/documents/recipients')}
                  testID="recipients-entry"
                />
              </ListSection>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.xl, paddingBottom: spacing.xxxl },
  titleBlock: { gap: spacing.xxs },
  center: { gap: spacing.sm, alignItems: 'center' },
});
