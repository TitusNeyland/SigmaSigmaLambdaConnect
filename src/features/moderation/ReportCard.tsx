import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RESTRICT_DAYS, type ReportAction, type ReportCase } from '@/data/moderation';
import { timeAgo } from '@/features/feed/feedLogic';
import { useStorageUrl } from '@/features/feed/useStorageUrl';
import { colors, radius, spacing } from '@/theme';
import { AppText, Avatar, Button, StatusChip } from '@/ui';

import {
  ACTION_TITLES,
  actionsFor,
  authorLine,
  countLabel,
  doneLabel,
  kindLabel,
  reasonLabel,
} from './moderationLogic';

type State =
  | { step: 'open' }
  | { step: 'saving'; action: ReportAction }
  | { step: 'done'; action: ReportAction; decisionId: string }
  | { step: 'undoing'; action: ReportAction; decisionId: string };

const THUMB = 56;

function Thumb({ path }: { path: string }) {
  const uri = useStorageUrl(path);
  return (
    <View style={styles.thumb}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessible={false}
        />
      ) : null}
    </View>
  );
}

/** One reported post, comment or member, with Keep, Remove and Restrict, and undo after. */
export function ReportCard({
  report,
  now,
  onDecide,
  onUndo,
}: {
  report: ReportCase;
  now: Date;
  onDecide: (action: ReportAction) => Promise<string>;
  onUndo: (decisionId: string) => Promise<void>;
}) {
  const [state, setState] = useState<State>({ step: 'open' });
  const [failed, setFailed] = useState<string | null>(null);
  const id = report.key;

  async function decide(action: ReportAction) {
    setFailed(null);
    setState({ step: 'saving', action });
    try {
      const decisionId = await onDecide(action);
      setState({ step: 'done', action, decisionId });
    } catch {
      setState({ step: 'open' });
      setFailed('Couldn’t save that. Try again.');
    }
  }

  async function undo() {
    if (state.step !== 'done') return;
    setFailed(null);
    setState({ ...state, step: 'undoing' });
    try {
      await onUndo(state.decisionId);
      setState({ step: 'open' });
    } catch {
      setState({ ...state, step: 'done' });
      setFailed('Couldn’t undo. Try again.');
    }
  }

  if (state.step === 'done' || state.step === 'undoing') {
    return (
      <View style={[styles.card, styles.doneCard]} testID={`case-${id}`}>
        <AppText
          variant="subhead"
          style={styles.flex}
          accessibilityLiveRegion="polite"
          testID={`case-done-${id}`}
        >
          {doneLabel(state.action, report, RESTRICT_DAYS)}
        </AppText>
        <Button
          title="Undo"
          variant="plain"
          size="small"
          loading={state.step === 'undoing'}
          onPress={undo}
          testID={`case-undo-${id}`}
        />
        {failed ? (
          <AppText variant="footnote" color={colors.destructive} style={styles.full}>
            {failed}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card} testID={`case-${id}`}>
      <View style={styles.top}>
        <StatusChip label={kindLabel(report)} />
        <AppText variant="footnote" weight="600" testID={`case-count-${id}`}>
          {countLabel(report.count)}
        </AppText>
        {report.latestAt ? (
          <AppText variant="footnote" color={colors.textSecondary}>
            · {timeAgo(report.latestAt, now)}
          </AppText>
        ) : null}
      </View>

      <View style={styles.author}>
        <Avatar name={report.authorName} uri={report.authorPhotoURL} size={32} />
        <AppText variant="subhead" weight="600" style={styles.flex}>
          {authorLine(report)}
        </AppText>
      </View>

      {report.targetType !== 'member' ? (
        report.preview ? (
          <View style={styles.preview} testID={`case-preview-${id}`}>
            {report.preview.photoPath ? <Thumb path={report.preview.photoPath} /> : null}
            <View style={styles.flex}>
              <AppText variant="callout" numberOfLines={3}>
                {report.preview.text || 'No caption'}
              </AppText>
              {report.preview.photoCount > 0 ? (
                <AppText variant="caption" color={colors.textSecondary}>
                  {report.preview.photoCount} {report.preview.photoCount === 1 ? 'photo' : 'photos'}
                </AppText>
              ) : null}
            </View>
          </View>
        ) : (
          <AppText variant="footnote" color={colors.textSecondary} testID={`case-gone-${id}`}>
            This was already deleted.
          </AppText>
        )
      ) : null}

      <View style={styles.reasons} testID={`case-reasons-${id}`}>
        {report.reasons.map((r) => (
          <StatusChip key={r.reason} label={reasonLabel(r)} tone="warning" />
        ))}
      </View>
      {report.details.map((d, i) => (
        <AppText key={i} variant="footnote" color={colors.textSecondary}>
          “{d}”
        </AppText>
      ))}

      <View style={styles.actions}>
        {actionsFor(report).map((action) => (
          <View key={action} style={styles.flex}>
            <Button
              title={ACTION_TITLES[action]}
              variant={action === 'removed' ? 'destructive' : 'secondary'}
              size="small"
              fullWidth
              disabled={state.step === 'saving'}
              loading={state.step === 'saving' && state.action === action}
              onPress={() => decide(action)}
              accessibilityLabel={
                action === 'restricted'
                  ? `Restrict ${report.authorName} for ${RESTRICT_DAYS} days`
                  : `${ACTION_TITLES[action]} this ${kindLabel(report).toLowerCase()}`
              }
              testID={`case-${action}-${id}`}
            />
          </View>
        ))}
      </View>
      {failed ? (
        <AppText variant="footnote" color={colors.destructive} testID={`case-failed-${id}`}>
          {failed}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  doneCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  preview: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundGrouped,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.fill,
  },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1, gap: spacing.xxs },
  full: { width: '100%' },
});
