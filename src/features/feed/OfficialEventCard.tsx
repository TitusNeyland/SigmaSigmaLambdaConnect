import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fetchEventSummary, RsvpSaveError, setRsvp, type EventSummary } from '@/data/events';
import { DateBlock } from '@/features/events/EventRow';
import { formatDay, formatTime, RSVP_LABELS } from '@/features/events/eventsLogic';
import { colors, radius, spacing } from '@/theme';
import { AppText, Button } from '@/ui';

/**
 * The event an official post is about, with a one-tap RSVP. Tap the card for full details.
 * Hidden if the event was deleted.
 */
export function OfficialEventCard({
  eventId,
  me,
  now,
}: {
  eventId: string;
  me: string;
  now: Date;
}) {
  const [event, setEvent] = useState<EventSummary | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    let live = true;
    fetchEventSummary(eventId, me).then(
      (e) => live && setEvent(e),
      () => live && setEvent(null),
    );
    return () => {
      live = false;
    };
  }, [eventId, me]);

  if (!event) return null;

  async function going() {
    if (!event) return;
    const before = event;
    setEvent({ ...event, myRsvp: 'going' });
    setSaving(true);
    setError(null);
    try {
      await setRsvp(eventId, me, 'going');
    } catch (e) {
      setEvent(before);
      setError(
        e instanceof RsvpSaveError && e.reason === 'closed'
          ? 'RSVPs are closed for this event.'
          : 'Couldn’t save your RSVP. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  const when = `${formatDay(event.startsAt, now)}, ${formatTime(event.startsAt)}`;

  return (
    <View style={styles.card} testID={`official-event-${eventId}`}>
      <Pressable
        onPress={() => router.push({ pathname: '/events/[id]', params: { id: eventId } })}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${when}${event.location ? `, ${event.location}` : ''}`}
        style={styles.row}
        testID={`official-event-open-${eventId}`}
      >
        <DateBlock date={event.startsAt} />
        <View style={styles.flex}>
          <AppText variant="subhead" weight="600" numberOfLines={1}>
            {event.title}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {[when, event.location].filter(Boolean).join(' · ')}
          </AppText>
        </View>
      </Pressable>
      {event.cancelled ? (
        <AppText variant="footnote" weight="600" color={colors.warning}>
          This event was cancelled.
        </AppText>
      ) : event.myRsvp ? (
        <AppText
          variant="footnote"
          color={colors.textSecondary}
          testID={`official-rsvp-${eventId}`}
        >
          You said {RSVP_LABELS[event.myRsvp].toLowerCase()}. Change it on the event.
        </AppText>
      ) : (
        <Button
          title="I’m going"
          size="small"
          onPress={going}
          loading={saving}
          fullWidth
          testID={`official-going-${eventId}`}
        />
      )}
      {error ? (
        <AppText variant="footnote" color={colors.destructive}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
});
