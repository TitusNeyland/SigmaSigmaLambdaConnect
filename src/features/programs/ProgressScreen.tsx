import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchMyHelpOffers, fetchPrograms, offerHelp, type ProgramSummary } from '@/data/programs';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, palette, radius, spacing } from '@/theme';
import { AppText, Button, NavHeader, ProgressBar, ProgressRing, StatusChip } from '@/ui';

import { STATUS_TONES } from './ProgramDetailScreen';
import {
  chapterPercent,
  dueLabel,
  groupPrograms,
  percentDone,
  STATUS_LABELS,
} from './programLogic';

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; programs: ProgramSummary[]; offers: ReadonlySet<string> }
  | { state: 'error' };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter');
}

function ProgramCard({
  program,
  now,
  offered,
  onHelp,
}: {
  program: ProgramSummary;
  now: Date;
  offered: boolean;
  onHelp: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const percent = percentDone(program.milestones);
  const needsHelp = program.status === 'at_risk';

  async function help() {
    setBusy(true);
    setFailed(false);
    try {
      await onHelp();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card} testID={`program-${program.id}`}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${program.name}, ${STATUS_LABELS[program.status]}, ${percent} percent done`}
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Hides the milestones' : 'Shows the milestones'}
        style={styles.cardHead}
        testID={`program-toggle-${program.id}`}
      >
        <View style={styles.titleRow}>
          <AppText variant="headline" style={styles.flex}>
            {program.name}
          </AppText>
          <StatusChip label={STATUS_LABELS[program.status]} tone={STATUS_TONES[program.status]} />
        </View>
        <AppText variant="footnote" color={colors.textSecondary}>
          {[program.ownerTitle, dueLabel(program.dueAt, now, program.status)]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <View style={styles.barRow}>
          <View style={styles.flex}>
            <ProgressBar percent={percent} tone={needsHelp ? 'warning' : 'gold'} />
          </View>
          <AppText variant="footnote" weight="600">
            {percent}%
          </AppText>
        </View>
      </Pressable>

      {open ? (
        <View style={styles.milestones} testID={`milestones-${program.id}`}>
          {program.milestones.map((m) => (
            <View
              key={m.id}
              style={styles.milestone}
              accessible
              accessibilityLabel={`${m.name}, ${m.done ? 'done' : 'not done'}`}
            >
              <View style={[styles.dot, m.done && styles.dotDone]} />
              <AppText variant="subhead" color={m.done ? colors.textSecondary : colors.text}>
                {m.name}
              </AppText>
            </View>
          ))}
          <Button
            title="Open program"
            variant="plain"
            size="small"
            onPress={() =>
              router.push({ pathname: '/chapter/programs/[id]', params: { id: program.id } })
            }
            testID={`program-open-${program.id}`}
          />
        </View>
      ) : null}

      {needsHelp ? (
        <View style={styles.help}>
          {offered ? (
            <AppText
              variant="footnote"
              color={colors.textSecondary}
              testID={`helped-${program.id}`}
            >
              Thanks for offering. {program.ownerTitle || 'The officers'} will reach out.
            </AppText>
          ) : (
            <Button
              title="I can help"
              size="small"
              onPress={help}
              loading={busy}
              fullWidth
              testID={`help-${program.id}`}
            />
          )}
          {failed ? (
            <AppText variant="footnote" color={colors.destructive}>
              Couldn’t send that. Try again.
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** How the chapter's programs are going, grouped so brothers can see where help is needed. */
export function ProgressScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!uid) return;
    let live = true;
    fetchPrograms()
      .then(async (programs) => {
        const offers = await fetchMyHelpOffers(
          programs.filter((p) => p.status === 'at_risk').map((p) => p.id),
          uid,
        ).catch(() => new Set<string>());
        if (live) setLoaded({ state: 'ready', programs, offers });
      })
      .catch(() => live && setLoaded({ state: 'error' }));
    return () => {
      live = false;
    };
  }, [uid, attempt]);

  async function help(programId: string) {
    await offerHelp(programId, uid);
    setLoaded((l) =>
      l.state === 'ready' ? { ...l, offers: new Set([...l.offers, programId]) } : l,
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="progress-back" />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Chapter progress
        </AppText>

        {loaded.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : loaded.state === 'error' ? (
          <View style={styles.center}>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Couldn’t load programs.
            </AppText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setLoaded({ state: 'loading' });
                setAttempt((n) => n + 1);
              }}
              testID="progress-retry"
            />
          </View>
        ) : loaded.programs.length === 0 ? (
          <AppText
            variant="callout"
            color={colors.textSecondary}
            align="center"
            testID="progress-empty"
          >
            No programs yet. Officers add them for the chapter year.
          </AppText>
        ) : (
          <>
            <View style={styles.summary}>
              <ProgressRing
                percent={chapterPercent(loaded.programs)}
                size={72}
                accessibilityLabel={`Chapter programs ${chapterPercent(loaded.programs)} percent done`}
                testID="progress-ring"
              />
              <View style={styles.flex}>
                <AppText variant="headline">
                  {loaded.programs.filter((p) => p.status === 'completed').length} of{' '}
                  {loaded.programs.length} programs complete
                </AppText>
                <AppText variant="footnote" color={colors.textSecondary}>
                  Goals the chapter set for this year, not national requirements.
                </AppText>
              </View>
            </View>
            {groupPrograms(loaded.programs).map((group) => (
              <View key={group.key} style={styles.group} testID={`group-${group.key}`}>
                <AppText
                  variant="sectionHeader"
                  color={colors.textSecondary}
                  accessibilityRole="header"
                >
                  {group.title.toUpperCase()}
                </AppText>
                {group.programs.map((p) => (
                  <ProgramCard
                    key={p.id}
                    program={p}
                    now={now}
                    offered={loaded.offers.has(p.id)}
                    onHelp={() => help(p.id)}
                  />
                ))}
              </View>
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
  center: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  group: { gap: spacing.sm },
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  cardHead: { padding: spacing.lg, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  flex: { flex: 1, gap: spacing.xxs },
  milestones: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: spacing.sm + 2,
    height: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.tertiary,
  },
  dotDone: { backgroundColor: palette.gold, borderColor: palette.gold },
  help: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs },
});
