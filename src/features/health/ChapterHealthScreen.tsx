import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchKpis, type CurrentKpis } from '@/data/leadership';
import { fetchPrograms, type ProgramSummary } from '@/data/programs';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Button, Chevron, NavHeader, ProgressBar, SectionTitle } from '@/ui';

import {
  chapterHealth,
  HEALTH_LABEL,
  healthLine,
  YELLOW_POINTS,
  type Health,
  type HealthCounts,
} from './healthLogic';

/** Fills for each status. Text beside them always says the status too. */
const FILL: Record<Health, string> = {
  green: palette.healthGreen,
  yellow: palette.healthYellow,
  red: palette.destructive,
  none: palette.tertiary,
};

/** Status text colors, each at least 4.5:1 on white. */
const TEXT: Record<Health, string> = {
  green: colors.success,
  yellow: colors.warning,
  red: colors.destructive,
  none: colors.textSecondary,
};

type Loaded =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; programs: ProgramSummary[]; kpis: CurrentKpis | null; now: Date };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter/leadership');
}

function Dot({ health }: { health: Health }) {
  return <View style={[styles.dot, { backgroundColor: FILL[health] }]} />;
}

function Status({ health, label, testID }: { health: Health; label: string; testID?: string }) {
  return (
    <AppText variant="footnote" weight="600" color={TEXT[health]} testID={testID}>
      {label}
    </AppText>
  );
}

/** One bar split into green, yellow, red and grey, sized by how many of each. */
function HealthBar({ counts }: { counts: HealthCounts }) {
  const order = ['green', 'yellow', 'red', 'none'] as const;
  const total = order.reduce((n, h) => n + counts[h], 0);
  return (
    <View style={styles.bar} accessibilityElementsHidden testID="health-bar">
      {total === 0
        ? null
        : order
            .filter((h) => counts[h] > 0)
            .map((h) => (
              <View
                key={h}
                style={{ flex: counts[h], backgroundColor: FILL[h] }}
                testID={`health-bar-${h}`}
              />
            ))}
    </View>
  );
}

function Stat({ value, label, testID }: { value: string; label: string; testID: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="title3" testID={testID}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.textSecondary} align="center">
        {label}
      </AppText>
    </View>
  );
}

/**
 * Chapter health for officers: every program and goal for the chapter year, green, yellow
 * or red by how it's keeping pace, worst first.
 */
export function ChapterHealthScreen() {
  const canLead = useCan('leadership.view');
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!canLead) return;
      let live = true;
      Promise.all([fetchPrograms(), fetchKpis()]).then(
        ([programs, kpis]) =>
          live && setLoaded({ state: 'ready', programs, kpis, now: new Date() }),
        () => live && setLoaded({ state: 'error' }),
      );
      return () => {
        live = false;
      };
      // attempt isn't read; bumping it is how Try again reloads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canLead, attempt]),
  );

  // Fails closed: no role loaded means a regular member, who never sees this.
  if (!canLead) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <NavHeader onBack={goBack} backTestID="health-back" />
        <View style={styles.content}>
          <AppText variant="callout" color={colors.textSecondary} testID="health-denied">
            Only officers can see this.
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const year = loaded.state === 'ready' ? (loaded.kpis?.periods.year ?? null) : null;
  const health = loaded.state === 'ready' ? chapterHealth(loaded.programs, year, loaded.now) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="health-back" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <AppText variant="largeTitle" accessibilityRole="header">
            Chapter health
          </AppText>
          <AppText variant="subhead" color={colors.textSecondary}>
            {year?.label ?? 'This chapter year'}
          </AppText>
        </View>

        {loaded.state === 'loading' || !health ? (
          loaded.state === 'error' ? (
            <View style={styles.center}>
              <AppText variant="callout" color={colors.textSecondary} align="center">
                Couldn’t load chapter health.
              </AppText>
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => {
                  setLoaded({ state: 'loading' });
                  setAttempt((n) => n + 1);
                }}
                testID="health-retry"
              />
            </View>
          ) : (
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Loading…
            </AppText>
          )
        ) : (
          <>
            <View
              style={styles.card}
              accessible
              accessibilityLabel={`Overall, ${healthLine(health.counts)}`}
              testID="health-summary"
            >
              <AppText variant="headline">Overall</AppText>
              <HealthBar counts={health.counts} />
              <View style={styles.legend}>
                {(['green', 'yellow', 'red'] as const).map((h) => (
                  <View key={h} style={styles.legendItem}>
                    <Dot health={h} />
                    <AppText variant="footnote" testID={`health-count-${h}`}>
                      {health.counts[h]} {HEALTH_LABEL[h].toLowerCase()}
                    </AppText>
                  </View>
                ))}
              </View>
              <View style={styles.divider} />
              <View style={styles.stats}>
                <Stat
                  value={`${health.programsPercent}%`}
                  label="Program milestones done"
                  testID="health-programs-percent"
                />
                <Stat
                  value={`${health.goalsMet} of ${health.goalsTotal}`}
                  label="Goals met"
                  testID="health-goals-met"
                />
                <Stat
                  value={health.yearPercent === null ? '–' : `${health.yearPercent}%`}
                  label="Of the year gone"
                  testID="health-year"
                />
              </View>
            </View>

            <View style={styles.section}>
              <SectionTitle title="Programs" />
              <View style={styles.list}>
                {health.programs.length === 0 ? (
                  <AppText
                    variant="callout"
                    color={colors.textSecondary}
                    style={styles.message}
                    testID="health-no-programs"
                  >
                    No programs yet.
                  </AppText>
                ) : (
                  health.programs.map((p, i) => (
                    <View key={p.id}>
                      {i > 0 ? <View style={styles.separator} /> : null}
                      <Pressable
                        onPress={() =>
                          router.push({ pathname: '/chapter/programs/[id]', params: { id: p.id } })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`${p.name}, ${p.label}, ${p.percent} percent done, ${p.note}`}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                        testID={`health-program-${p.id}`}
                      >
                        <View style={styles.rowTop}>
                          <Dot health={p.health} />
                          <View style={styles.flex}>
                            <AppText variant="subhead" weight="600">
                              {p.name}
                            </AppText>
                            <AppText variant="caption" color={colors.textSecondary}>
                              {p.detail}
                            </AppText>
                          </View>
                          <View style={styles.right}>
                            <Status
                              health={p.health}
                              label={p.label}
                              testID={`health-program-${p.id}-status`}
                            />
                            <AppText variant="caption" color={colors.textSecondary}>
                              {p.percent}%
                            </AppText>
                          </View>
                          <Chevron />
                        </View>
                        <ProgressBar
                          percent={p.percent}
                          color={FILL[p.health]}
                          accessibilityLabel={`${p.percent} percent of milestones done`}
                        />
                        <AppText variant="caption" color={colors.textSecondary}>
                          {p.note}
                        </AppText>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={styles.section}>
              <SectionTitle title="Goals" />
              <View style={styles.list}>
                {health.goals.length === 0 ? (
                  <AppText
                    variant="callout"
                    color={colors.textSecondary}
                    style={styles.message}
                    testID="health-no-goals"
                  >
                    No goals set for this chapter year yet.
                  </AppText>
                ) : (
                  health.goals.map((g, i) => (
                    <View key={g.id}>
                      {i > 0 ? <View style={styles.separator} /> : null}
                      <View
                        style={styles.row}
                        accessible
                        accessibilityLabel={`${g.name}, ${g.label}, ${g.progress}, ${g.note}`}
                        testID={`health-goal-${g.id}`}
                      >
                        <View style={styles.rowTop}>
                          <Dot health={g.health} />
                          <View style={styles.flex}>
                            <AppText variant="subhead" weight="600">
                              {g.name}
                            </AppText>
                            <AppText variant="caption" color={colors.textSecondary}>
                              {g.progress} · {g.note}
                            </AppText>
                          </View>
                          <Status
                            health={g.health}
                            label={g.label}
                            testID={`health-goal-${g.id}-status`}
                          />
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            <AppText variant="footnote" color={colors.textSecondary} testID="health-key">
              Green is on pace for this point in the year. Yellow is a little behind (one milestone,
              or up to {YELLOW_POINTS} points). Red is further behind, past due or flagged as
              needing help. Goals are set by your officers, not national requirements.
            </AppText>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const DOT = 10;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.xl, paddingBottom: spacing.xxxl },
  titleBlock: { gap: spacing.xxs },
  center: { paddingTop: spacing.xxl, gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1, gap: spacing.xxs },
  pressed: { opacity: 0.7 },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  bar: {
    flexDirection: 'row',
    height: spacing.md,
    gap: spacing.xxs,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.hairline,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  section: { gap: spacing.xs },
  list: { borderRadius: radius.xl, backgroundColor: colors.surface, overflow: 'hidden' },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  right: { alignItems: 'flex-end', gap: spacing.xxs },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginLeft: spacing.lg,
  },
  message: { padding: spacing.lg },
});
