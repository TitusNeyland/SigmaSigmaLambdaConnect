import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchEventDetail, RsvpSaveError, setRsvp, type EventDetail } from '@/data/events';
import type { RsvpStatus } from '@/data/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, palette, radius, spacing } from '@/theme';
import { AppText, Avatar, Button, ListSection, NavHeader, SegmentedControl } from '@/ui';

import {
  addToCalendar,
  destination,
  openDirections,
  type AddToCalendarResult,
} from './eventActions';
import {
  CATEGORY_LABELS,
  deadlineText,
  formatDay,
  formatFee,
  formatTimeRange,
  goingSummary,
  RSVP_SEGMENTS,
  rsvpLocked,
  rsvpMessage,
} from './eventsLogic';

type State =
  | { state: 'loading' }
  | { state: 'ready'; event: EventDetail | null; at: Date }
  | { state: 'error' };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/events');
}

/** A labeled detail line: small gray label over the value, like iOS contact cards. */
function DetailRow({
  label,
  value,
  detail,
  action,
  testID,
}: {
  label: string;
  value: string;
  detail?: string;
  /** A small button on the right, like Add or Directions. */
  action?: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View
        style={styles.detailText}
        accessible
        accessibilityLabel={[label, value, detail].filter(Boolean).join(', ')}
        testID={testID}
      >
        <AppText variant="footnote" color={colors.textSecondary}>
          {label}
        </AppText>
        <AppText>{value}</AppText>
        {detail ? (
          <AppText variant="subhead" color={colors.textSecondary}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const CALENDAR_MESSAGES: Record<Exclude<AddToCalendarResult, 'canceled'>, string> = {
  added: 'Added to your calendar.',
  failed: 'Couldn’t open your calendar. Try again.',
};

export function EventDetailScreen({ id }: { id: string }) {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const [value, setValue] = useState<{ id: string; state: State } | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Reload on focus so the going count stays fresh after RSVPing (#23).
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let live = true;
      const at = new Date();
      fetchEventDetail(id, uid).then(
        (event) => live && setValue({ id, state: { state: 'ready', event, at } }),
        () =>
          live &&
          setValue((v) =>
            v?.id === id && v.state.state === 'ready' ? v : { id, state: { state: 'error' } },
          ),
      );
      return () => {
        live = false;
      };
      // attempt isn't read inside; bumping it is how Try again reloads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, uid, attempt]),
  );

  // The member's choice while it saves, so the control answers at once.
  const [choice, setChoice] = useState<{ id: string; status: RsvpStatus } | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [calendarNote, setCalendarNote] = useState<{ id: string; text: string } | null>(null);
  const [directionsFailed, setDirectionsFailed] = useState(false);

  const current: State = value?.id === id ? value.state : { state: 'loading' };

  async function rsvp(status: RsvpStatus, previous: RsvpStatus | null) {
    setChoice({ id, status });
    setRsvpError(null);
    try {
      await setRsvp(id, uid, status);
    } catch (error) {
      setChoice(previous ? { id, status: previous } : null);
      setRsvpError(
        error instanceof RsvpSaveError && error.reason === 'closed'
          ? 'RSVPs just closed for this event.'
          : 'Couldn’t save your RSVP. Check your connection and try again.',
      );
    } finally {
      // Refresh the going count and, if RSVPs closed meanwhile, the locked state.
      setAttempt((n) => n + 1);
    }
  }

  if (current.state !== 'ready' || !current.event) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <NavHeader onBack={goBack} backTestID="event-back" />
        <View style={styles.center}>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            {current.state === 'loading'
              ? 'Loading…'
              : current.state === 'error'
                ? 'Couldn’t load this event.'
                : 'This event isn’t available. It may have been deleted.'}
          </AppText>
          {current.state === 'error' ? (
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setValue(null);
                setAttempt((n) => n + 1);
              }}
              testID="event-retry"
            />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const { event, at } = current;
  const names = event.going.preview.map((a) => a.displayName);
  const myRsvp = choice?.id === id ? choice.status : event.myRsvp;
  const locked = rsvpLocked(event, new Date());

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="event-back" />
      <ScrollView contentContainerStyle={styles.content}>
        {event.photoURL ? (
          <Image
            source={{ uri: event.photoURL }}
            style={styles.hero}
            contentFit="cover"
            accessibilityLabel={`Photo for ${event.title}`}
            testID="event-hero"
          />
        ) : (
          <View style={[styles.hero, styles.heroBlank]} testID="event-hero-blank">
            <AppText variant="title" color={palette.goldSoftText}>
              ΣΣΛ
            </AppText>
          </View>
        )}

        <View style={styles.heading}>
          <AppText variant="footnote" weight="700" color={colors.link}>
            {CATEGORY_LABELS[event.category].toUpperCase()}
          </AppText>
          <AppText variant="title2" accessibilityRole="header">
            {event.title}
          </AppText>
          {event.host ? (
            <View style={styles.host} testID="event-host">
              <Avatar name={event.host.displayName} uri={event.host.photoURL} size={28} />
              <AppText variant="subhead" color={colors.textSecondary}>
                Hosted by {event.host.displayName}
              </AppText>
            </View>
          ) : null}
        </View>

        {event.cancelled ? (
          <View style={styles.cancelled} testID="event-cancelled">
            <AppText variant="callout" weight="600" color={colors.warning} align="center">
              This event was cancelled.
            </AppText>
          </View>
        ) : null}

        <View style={styles.rsvp} testID="rsvp">
          <AppText variant="headline">Your RSVP</AppText>
          <SegmentedControl
            segments={RSVP_SEGMENTS}
            value={myRsvp}
            onChange={(status) => rsvp(status, myRsvp)}
            accessibilityLabel="Your RSVP"
            disabled={locked}
            testID="rsvp-control"
          />
          <AppText
            variant="subhead"
            color={colors.textSecondary}
            accessibilityLiveRegion="polite"
            testID="rsvp-message"
          >
            {rsvpMessage(myRsvp, event, new Date())}
          </AppText>
          {rsvpError ? (
            <AppText variant="footnote" color={colors.destructive} testID="rsvp-error">
              {rsvpError}
            </AppText>
          ) : null}
        </View>

        <ListSection>
          <DetailRow
            label="Date"
            value={formatDay(event.startsAt, at)}
            detail={formatTimeRange(event.startsAt, event.endsAt)}
            action={
              event.cancelled ? undefined : (
                <Button
                  title="Add"
                  variant="secondary"
                  size="small"
                  accessibilityLabel="Add to calendar"
                  onPress={async () => {
                    setCalendarNote(null);
                    const result = await addToCalendar(event);
                    if (result !== 'canceled') {
                      setCalendarNote({ id, text: CALENDAR_MESSAGES[result] });
                    }
                  }}
                  testID="add-to-calendar"
                />
              )
            }
            testID="event-date"
          />
          <DetailRow
            label="Place"
            value={event.location}
            detail={event.address || undefined}
            action={
              destination(event) ? (
                <Button
                  title="Directions"
                  variant="secondary"
                  size="small"
                  accessibilityLabel={`Directions to ${event.location}`}
                  onPress={async () => setDirectionsFailed(!(await openDirections(event)))}
                  testID="directions"
                />
              ) : undefined
            }
            testID="event-place"
          />
          <DetailRow label="Fee" value={formatFee(event.feeCents)} testID="event-fee" />
          <DetailRow
            label="RSVP by"
            value={deadlineText(event.rsvpDeadline, at)}
            testID="event-deadline"
          />
        </ListSection>

        {calendarNote?.id === id || directionsFailed ? (
          <AppText
            variant="footnote"
            color={colors.textSecondary}
            align="center"
            accessibilityLiveRegion="polite"
            testID="event-action-note"
          >
            {directionsFailed ? 'Couldn’t open maps. Try again.' : calendarNote?.text}
          </AppText>
        ) : null}

        <ListSection header="Who’s going">
          <View style={styles.going} testID="event-going">
            {event.going.preview.length > 0 ? (
              <View style={styles.faces}>
                {event.going.preview.map((a, i) => (
                  <View key={a.uid} style={[styles.face, i > 0 && styles.faceOverlap]}>
                    <Avatar name={a.displayName} uri={a.photoURL} size={32} />
                  </View>
                ))}
              </View>
            ) : null}
            <AppText variant="subhead" style={styles.flex}>
              {goingSummary(event.going.count, names)}
            </AppText>
          </View>
        </ListSection>

        {event.description.trim() ? (
          <ListSection header="About">
            <View style={styles.about}>
              <AppText testID="event-about">{event.description.trim()}</AppText>
            </View>
          </ListSection>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },
  hero: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg },
  heroBlank: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { gap: spacing.xs },
  rsvp: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  host: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  cancelled: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.warningSoft,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  detailText: { flex: 1, gap: spacing.xxs },
  going: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  faces: { flexDirection: 'row' },
  face: { borderRadius: radius.pill, borderWidth: 2, borderColor: colors.surface },
  faceOverlap: { marginLeft: -spacing.sm },
  about: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
});
