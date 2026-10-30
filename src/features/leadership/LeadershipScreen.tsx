import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchKpis,
  fetchWaitingCounts,
  type CurrentKpis,
  type WaitingCounts,
} from '@/data/leadership';
import { fetchPrograms, type ProgramSummary } from '@/data/programs';
import { decideRequest, fetchPendingRequests, type MembershipRequest } from '@/data/requests';
import type { KpiPeriodKind } from '@/data/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { RequestRow } from '@/features/requests/RequestRow';
import { useCan, useRole } from '@/features/roles/RoleProvider';
import { colors, palette, radius, spacing } from '@/theme';
import {
  AppText,
  Button,
  ListRow,
  ListSection,
  NavHeader,
  ProgressRing,
  SegmentedControl,
} from '@/ui';

import { goalProgress, goalsPercent, kpiTiles, updatedLabel } from './leadershipLogic';

const PERIODS = [
  { value: 'semester', label: 'Semester' },
  { value: 'year', label: 'Chapter year' },
  { value: 'days30', label: '30 days' },
] as const satisfies readonly { value: KpiPeriodKind; label: string }[];

/** How many sign-ups to show right on this screen; the rest are a tap away. */
export const INLINE_REQUESTS = 3;

type Loaded =
  { state: 'loading' } | { state: 'error' } | { state: 'ready'; kpis: CurrentKpis | null };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter');
}

function Count({ n, testID }: { n: number; testID: string }) {
  return (
    <View style={styles.count} testID={testID}>
      <AppText variant="caption" weight="700" color={palette.onInk}>
        {String(n)}
      </AppText>
    </View>
  );
}

/** Officers' view of chapter health: goals, KPIs, what needs attention, quick actions. */
export function LeadershipScreen() {
  const { label } = useRole();
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const canLead = useCan('leadership.view');
  const canApprove = useCan('members.approve');
  const canReview = useCan('reports.review');
  const canAttend = useCan('attendance.take');
  const canAnnounce = useCan('announcements.post');
  const canEvents = useCan('events.manage');
  const canPrograms = useCan('programs.manage');

  const [period, setPeriod] = useState<KpiPeriodKind>('semester');
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [waiting, setWaiting] = useState<WaitingCounts | null>(null);
  const [atRisk, setAtRisk] = useState<ProgramSummary[]>([]);
  const [pending, setPending] = useState<MembershipRequest[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      if (!canLead) return;
      let live = true;
      fetchKpis().then(
        (kpis) => {
          if (!live) return;
          setNow(new Date());
          setLoaded({ state: 'ready', kpis });
        },
        () => live && setLoaded({ state: 'error' }),
      );
      fetchWaitingCounts().then(
        (w) => live && setWaiting(w),
        () => {},
      );
      fetchPrograms().then(
        (p) => live && setAtRisk(p.filter((x) => x.status === 'at_risk')),
        () => {},
      );
      if (canApprove) {
        fetchPendingRequests().then(
          (r) => live && setPending(r),
          () => {},
        );
      }
      return () => {
        live = false;
      };
      // attempt isn't read; bumping it is how Try again reloads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canLead, canApprove, attempt]),
  );

  // Fails closed: no role loaded means a regular member, who never sees this.
  if (!canLead) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <NavHeader onBack={goBack} backTestID="leadership-back" />
        <View style={styles.content}>
          <AppText variant="callout" color={colors.textSecondary} testID="leadership-denied">
            Only officers can see this.
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const kpis = loaded.state === 'ready' ? loaded.kpis : null;
  const current = kpis?.periods[period] ?? null;
  const requests = canApprove ? pending.length : 0;
  const reports = canReview ? (waiting?.openReports ?? 0) : 0;
  const nothingNeeded = requests === 0 && reports === 0 && atRisk.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="leadership-back" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <AppText variant="largeTitle" accessibilityRole="header">
            Leadership
          </AppText>
          <AppText variant="subhead" color={colors.textSecondary}>
            Signed in as {label}
          </AppText>
        </View>

        <SegmentedControl
          segments={PERIODS}
          value={period}
          onChange={setPeriod}
          accessibilityLabel="Period"
          testID="period"
        />

        {loaded.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : loaded.state === 'error' ? (
          <View style={styles.center}>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Couldn’t load the numbers.
            </AppText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setLoaded({ state: 'loading' });
                setAttempt((n) => n + 1);
              }}
              testID="kpis-retry"
            />
          </View>
        ) : !current ? (
          <View style={styles.card} testID="kpis-empty">
            <AppText variant="headline">No numbers yet</AppText>
            <AppText variant="footnote" color={colors.textSecondary}>
              They’re worked out every hour from check-ins, service hours and posts.
            </AppText>
          </View>
        ) : (
          <>
            <View style={styles.card} testID="goals-card">
              <View style={styles.goalsHead}>
                <ProgressRing
                  percent={goalsPercent(current)}
                  size={72}
                  accessibilityLabel={`${current.goalsDone} of ${current.goalsTotal} chapter goals met`}
                  testID="goals-ring"
                />
                <View style={styles.flex}>
                  <AppText variant="headline" testID="goals-line">
                    {current.goalsTotal
                      ? `${current.goalsDone} of ${current.goalsTotal} goals met`
                      : 'No goals set yet'}
                  </AppText>
                  <AppText variant="footnote" color={colors.textSecondary}>
                    Goals the chapter set for {kpis?.periods.year.label ?? 'this year'}, not
                    national requirements.
                  </AppText>
                </View>
              </View>
              {current.goals.map((g) => (
                <View
                  key={g.id}
                  style={styles.goal}
                  accessible
                  accessibilityLabel={`${g.name}, ${goalProgress(g)}${g.met ? ', met' : ''}`}
                  testID={`goal-${g.id}`}
                >
                  <View style={[styles.dot, g.met && styles.dotMet]} />
                  <AppText variant="subhead" style={styles.flex}>
                    {g.name}
                  </AppText>
                  <AppText variant="footnote" color={colors.textSecondary}>
                    {goalProgress(g)}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={styles.tiles}>
              {kpiTiles(current).map((t) => (
                <View
                  key={t.key}
                  style={styles.tile}
                  accessible
                  accessibilityLabel={`${t.label}, ${t.value}, ${t.caption}`}
                  testID={`kpi-${t.key}`}
                >
                  <AppText variant="footnote" color={colors.textSecondary}>
                    {t.label}
                  </AppText>
                  <AppText variant="title" weight="700" testID={`kpi-${t.key}-value`}>
                    {t.value}
                  </AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {t.caption}
                  </AppText>
                </View>
              ))}
            </View>
            <AppText
              variant="caption"
              color={colors.textSecondary}
              align="center"
              testID="kpis-updated"
            >
              {[current.label, updatedLabel(kpis?.computedAt ?? null, now)]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </>
        )}

        <ListSection header="Needs attention" testID="needs-attention">
          {canApprove
            ? pending
                .slice(0, INLINE_REQUESTS)
                .map((r) => (
                  <RequestRow
                    key={r.uid}
                    request={r}
                    now={now}
                    onDecide={(d) => decideRequest(r.uid, uid, d)}
                  />
                ))
            : null}
          {canApprove && requests > INLINE_REQUESTS ? (
            <ListRow
              title="All membership requests"
              trailing={<Count n={requests} testID="requests-count" />}
              showChevron
              onPress={() => router.push('/chapter/requests')}
              testID="attention-requests"
            />
          ) : null}
          {canReview && reports > 0 ? (
            <ListRow
              title="Reported posts and members"
              trailing={<Count n={reports} testID="reports-count" />}
              showChevron
              onPress={() => router.push('/chapter/reports')}
              testID="attention-reports"
            />
          ) : null}
          {atRisk.map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={['Needs help', p.ownerTitle].filter(Boolean).join(' · ')}
              onPress={() =>
                router.push({ pathname: '/chapter/programs/[id]', params: { id: p.id } })
              }
              testID={`attention-program-${p.id}`}
            />
          ))}
          {nothingNeeded ? (
            <ListRow title="Nothing needs attention" testID="attention-none" />
          ) : null}
        </ListSection>

        <ListSection header="Quick actions" testID="quick-actions">
          {canAttend ? (
            <ListRow
              title="Take attendance"
              onPress={() => router.push('/chapter/attendance')}
              testID="action-attendance"
            />
          ) : null}
          {canAnnounce ? (
            <ListRow
              title="Post announcement"
              onPress={() => router.push('/chapter/announcements/new')}
              testID="action-announce"
            />
          ) : null}
          {canEvents ? (
            <ListRow
              title="Create event"
              onPress={() => router.push('/events/new')}
              testID="action-event"
            />
          ) : null}
          {canPrograms ? (
            <ListRow
              title="Update a milestone"
              onPress={() => router.push('/chapter/progress')}
              testID="action-milestone"
            />
          ) : null}
        </ListSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },
  titleBlock: { gap: spacing.xxs },
  center: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  flex: { flex: 1, gap: spacing.xxs },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  goalsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  goal: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: spacing.sm + 2,
    height: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.tertiary,
  },
  dotMet: { backgroundColor: palette.gold, borderColor: palette.gold },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.xxs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  count: {
    minWidth: spacing.xl + spacing.xxs,
    height: spacing.xl + spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
