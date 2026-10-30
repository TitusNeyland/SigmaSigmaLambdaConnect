import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fetchProgram, setMilestoneDone, type ProgramSummary } from '@/data/programs';
import type { ProgressStatus } from '@/data/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import {
  AppText,
  Button,
  ListSection,
  NavHeader,
  ProgressBar,
  StatusChip,
  type ChipTone,
} from '@/ui';

import { dueLabel, percentDone, STATUS_LABELS, statusAfter } from './programLogic';

export const STATUS_TONES: Record<ProgressStatus, ChipTone> = {
  not_started: 'neutral',
  in_progress: 'success',
  at_risk: 'warning',
  completed: 'gold',
};

type Loaded =
  { state: 'loading' } | { state: 'ready'; program: ProgramSummary | null } | { state: 'error' };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter');
}

function Check({ done }: { done: boolean }) {
  return (
    <View style={[styles.box, done && styles.boxDone]}>
      {done ? (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
          <Path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke={palette.onInk}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

/** One program: owner, due date, percent and milestones. Officers check milestones off. */
export function ProgramDetailScreen({ id }: { id: string }) {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const canManage = useCan('programs.manage');
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let live = true;
    fetchProgram(id).then(
      (program) => live && setLoaded({ state: 'ready', program }),
      () => live && setLoaded({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [id, attempt]);

  const program = loaded.state === 'ready' ? loaded.program : null;

  async function toggle(milestoneId: string) {
    if (!program || saving) return;
    const before = program;
    const milestones = program.milestones.map((m) =>
      m.id === milestoneId ? { ...m, done: !m.done } : m,
    );
    const status = statusAfter(program.status, milestones);
    const done = milestones.find((m) => m.id === milestoneId)!.done;
    setLoaded({ state: 'ready', program: { ...program, milestones, status } });
    setSaving(milestoneId);
    setFailed(false);
    try {
      await setMilestoneDone(id, milestoneId, done, uid, status);
    } catch {
      setLoaded({ state: 'ready', program: before });
      setFailed(true);
    } finally {
      setSaving(null);
    }
  }

  if (!program) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <NavHeader onBack={goBack} backTestID="program-back" />
        <View style={styles.center}>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            {loaded.state === 'loading'
              ? 'Loading…'
              : loaded.state === 'error'
                ? 'Couldn’t load this program.'
                : 'This program isn’t available.'}
          </AppText>
          {loaded.state === 'error' ? (
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setLoaded({ state: 'loading' });
                setAttempt((n) => n + 1);
              }}
              testID="program-retry"
            />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const percent = percentDone(program.milestones);
  const doneCount = program.milestones.filter((m) => m.done).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="program-back" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <AppText variant="title2" accessibilityRole="header">
            {program.name}
          </AppText>
          <View style={styles.meta}>
            <StatusChip
              label={STATUS_LABELS[program.status]}
              tone={STATUS_TONES[program.status]}
              testID="program-status"
            />
            <AppText variant="subhead" color={colors.textSecondary} testID="program-due">
              {dueLabel(program.dueAt, now, program.status)}
            </AppText>
          </View>
          {program.ownerTitle ? (
            <AppText variant="subhead" color={colors.textSecondary}>
              Led by {program.ownerTitle}
            </AppText>
          ) : null}
          {program.description ? <AppText variant="callout">{program.description}</AppText> : null}
        </View>

        <View style={styles.progress}>
          <View style={styles.progressText}>
            <AppText variant="headline" testID="program-percent">
              {percent}% done
            </AppText>
            <AppText variant="subhead" color={colors.textSecondary}>
              {doneCount} of {program.milestones.length} milestones
            </AppText>
          </View>
          <ProgressBar percent={percent} accessibilityLabel={`${percent} percent done`} />
        </View>

        <ListSection
          header="Milestones"
          footer={
            canManage
              ? 'Tap a milestone to check it off. Members see the change right away.'
              : undefined
          }
        >
          {program.milestones.map((m) =>
            canManage ? (
              <Pressable
                key={m.id}
                onPress={() => toggle(m.id)}
                disabled={saving !== null}
                accessibilityRole="checkbox"
                accessibilityLabel={m.name}
                accessibilityState={{ checked: m.done, disabled: saving !== null }}
                style={styles.row}
                testID={`milestone-${m.id}`}
              >
                <Check done={m.done} />
                <AppText style={styles.flex} color={m.done ? colors.textSecondary : colors.text}>
                  {m.name}
                </AppText>
              </Pressable>
            ) : (
              <View
                key={m.id}
                style={styles.row}
                accessible
                accessibilityLabel={`${m.name}, ${m.done ? 'done' : 'not done'}`}
                testID={`milestone-${m.id}`}
              >
                <Check done={m.done} />
                <AppText style={styles.flex} color={m.done ? colors.textSecondary : colors.text}>
                  {m.name}
                </AppText>
              </View>
            ),
          )}
        </ListSection>
        {failed ? (
          <AppText
            variant="footnote"
            color={colors.destructive}
            align="center"
            testID="milestone-error"
          >
            Couldn’t save that. Check your connection and try again.
          </AppText>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.xl, paddingBottom: spacing.xxxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  heading: { gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progress: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  progressText: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: MIN_TOUCH + spacing.xs,
  },
  flex: { flex: 1 },
  box: {
    width: spacing.xl + spacing.xxs,
    height: spacing.xl + spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: palette.ink, borderColor: palette.ink },
});
