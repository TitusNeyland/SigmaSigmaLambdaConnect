import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchReportQueue,
  resolveReportCase,
  undoReportDecision,
  type ReportCase,
} from '@/data/moderation';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, spacing } from '@/theme';
import { AppText, Button, NavHeader } from '@/ui';

import { ReportCard } from './ReportCard';

type Loaded =
  { state: 'loading' } | { state: 'error' } | { state: 'ready'; cases: ReportCase[]; now: Date };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter/leadership');
}

/** The officers' queue of reported posts, comments and members. */
export function ReportsScreen() {
  const canReview = useCan('reports.review');
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!canReview) return;
      let live = true;
      fetchReportQueue().then(
        (cases) => live && setLoaded({ state: 'ready', cases, now: new Date() }),
        () => live && setLoaded({ state: 'error' }),
      );
      return () => {
        live = false;
      };
      // attempt isn't read; bumping it is how Try again reloads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canReview, attempt]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="reports-back" />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Reports
        </AppText>
        {!canReview ? (
          <AppText variant="callout" color={colors.textSecondary} testID="reports-denied">
            Only officers can see this.
          </AppText>
        ) : loaded.state === 'loading' ? (
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
              testID="reports-retry"
            />
          </View>
        ) : loaded.cases.length === 0 ? (
          <AppText
            variant="callout"
            color={colors.textSecondary}
            align="center"
            testID="reports-empty"
          >
            No open reports.
          </AppText>
        ) : (
          <>
            <AppText variant="footnote" color={colors.textSecondary}>
              Reporters stay anonymous. Every decision is logged with your name, and reporters are
              told the outcome.
            </AppText>
            {loaded.cases.map((c) => (
              <ReportCard
                key={c.key}
                report={c}
                now={loaded.now}
                onDecide={(action) => resolveReportCase(c.reportIds, action)}
                onUndo={undoReportDecision}
              />
            ))}
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
});
