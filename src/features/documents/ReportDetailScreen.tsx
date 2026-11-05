import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchReport, reportFileUrl, type CommitteeReport } from '@/data/committeeReports';
import { colors, radius, spacing } from '@/theme';
import { AppText, ListRow, ListSection, NavHeader, StatusChip } from '@/ui';

import { emailStatus, fileSize, shortDate } from './reportLogic';

type Loaded =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'ready'; report: CommitteeReport; now: Date };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter/documents');
}

/** One committee report: the submitter, the summary, and its file. */
export function ReportDetailScreen({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [fileFailed, setFileFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      // The rules let members read only their own; anything else reads as missing.
      fetchReport(id).then(
        (report) =>
          live &&
          setLoaded(report ? { state: 'ready', report, now: new Date() } : { state: 'missing' }),
        () => live && setLoaded({ state: 'missing' }),
      );
      return () => {
        live = false;
      };
    }, [id]),
  );

  async function openFile(path: string) {
    setFileFailed(false);
    try {
      await Linking.openURL(await reportFileUrl(path));
    } catch {
      setFileFailed(true);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="report-back" />
      {loaded.state !== 'ready' ? (
        <View style={styles.center}>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            {loaded.state === 'loading' ? 'Loading…' : 'This report isn’t available.'}
          </AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.titleBlock}>
            <AppText variant="title" accessibilityRole="header">
              {loaded.report.committee}
            </AppText>
            <AppText variant="subhead" color={colors.textSecondary} testID="report-meta">
              {[
                loaded.report.period,
                loaded.report.authorName,
                shortDate(loaded.report.createdAt, loaded.now),
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
            <View style={styles.chip}>
              <StatusChip {...emailStatus(loaded.report)} testID="report-status" />
            </View>
          </View>

          <View style={styles.card}>
            <AppText selectable testID="report-summary-text">
              {loaded.report.summary}
            </AppText>
          </View>

          {loaded.report.attachment ? (
            <ListSection
              header="File"
              footer={fileFailed ? 'Couldn’t open the file. Try again.' : undefined}
            >
              <ListRow
                title={loaded.report.attachment.name}
                subtitle={
                  loaded.report.attachment.size
                    ? fileSize(loaded.report.attachment.size)
                    : undefined
                }
                onPress={() => openFile(loaded.report.attachment!.path)}
                accessibilityHint="Opens the file"
                testID="report-open-file"
              />
            </ListSection>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.xl, paddingBottom: spacing.xxxl },
  titleBlock: { gap: spacing.xs },
  chip: { flexDirection: 'row' },
  card: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
