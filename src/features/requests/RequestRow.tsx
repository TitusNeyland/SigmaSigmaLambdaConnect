import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Decision, MembershipRequest } from '@/data/requests';
import { timeAgo } from '@/features/feed/feedLogic';
import { colors, spacing } from '@/theme';
import { AppText, Avatar, Button } from '@/ui';

type State =
  | { step: 'idle' }
  | { step: 'confirm-decline' }
  | { step: 'saving'; decision: Decision }
  | { step: 'done'; decision: Decision }
  | { step: 'failed' };

/**
 * One pending sign-up with Approve and Decline right on the row. Decline asks once more,
 * since the person loses access. Approving sends them a push (a Cloud Function).
 */
export function RequestRow({
  request,
  now,
  onDecide,
}: {
  request: MembershipRequest;
  now: Date;
  onDecide: (decision: Decision) => Promise<void>;
}) {
  const [state, setState] = useState<State>({ step: 'idle' });
  const name = request.displayName || 'New member';
  const id = request.uid;

  async function decide(decision: Decision) {
    setState({ step: 'saving', decision });
    try {
      await onDecide(decision);
      setState({ step: 'done', decision });
    } catch {
      setState({ step: 'failed' });
    }
  }

  const meta = [
    request.initiationTerm ? `Initiated ${request.initiationTerm}` : '',
    request.requestedAt ? `Asked ${timeAgo(request.requestedAt, now)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.row} testID={`request-${id}`}>
      <View style={styles.head}>
        <Avatar name={name} uri={request.photoURL} size={40} />
        <View style={styles.flex}>
          <AppText variant="body" weight="600">
            {name}
          </AppText>
          {meta ? (
            <AppText variant="footnote" color={colors.textSecondary}>
              {meta}
            </AppText>
          ) : null}
        </View>
      </View>

      {state.step === 'done' ? (
        <AppText
          variant="subhead"
          weight="600"
          color={state.decision === 'approved' ? colors.success : colors.textSecondary}
          accessibilityLiveRegion="polite"
          testID={`request-done-${id}`}
        >
          {state.decision === 'approved' ? `Approved. ${name} is in.` : 'Declined'}
        </AppText>
      ) : state.step === 'confirm-decline' ? (
        <View style={styles.actions}>
          <AppText variant="footnote" color={colors.textSecondary} style={styles.full}>
            Decline {name}? They won’t get into the app.
          </AppText>
          <View style={styles.flex}>
            <Button
              title="Cancel"
              variant="secondary"
              size="small"
              fullWidth
              onPress={() => setState({ step: 'idle' })}
              testID={`decline-cancel-${id}`}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Decline"
              variant="destructive"
              size="small"
              fullWidth
              onPress={() => decide('declined')}
              testID={`decline-confirm-${id}`}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button
              title="Decline"
              variant="secondary"
              size="small"
              fullWidth
              disabled={state.step === 'saving'}
              loading={state.step === 'saving' && state.decision === 'declined'}
              onPress={() => setState({ step: 'confirm-decline' })}
              accessibilityLabel={`Decline ${name}`}
              testID={`decline-${id}`}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Approve"
              size="small"
              fullWidth
              disabled={state.step === 'saving'}
              loading={state.step === 'saving' && state.decision === 'approved'}
              onPress={() => decide('approved')}
              accessibilityLabel={`Approve ${name}`}
              testID={`approve-${id}`}
            />
          </View>
          {state.step === 'failed' ? (
            <AppText
              variant="footnote"
              color={colors.destructive}
              style={styles.full}
              testID={`request-failed-${id}`}
            >
              Couldn’t save that. Try again.
            </AppText>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  full: { width: '100%' },
});
