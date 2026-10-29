import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { EventSummary } from '@/data/events';
import { colors, MIN_TOUCH, radius } from '@/theme';
import { AppText, ListRow, StatusChip, type ChipTone } from '@/ui';

import { dateBlock, formatTime, RSVP_LABELS } from './eventsLogic';

const RSVP_TONES: Record<NonNullable<EventSummary['myRsvp']>, ChipTone> = {
  going: 'success',
  maybe: 'gold',
  not_going: 'neutral',
};

export function openEvent(id: string) {
  router.push({ pathname: '/events/[id]', params: { id } });
}

/** Cancelled, or the member's RSVP. Nothing when they haven't answered. */
export function StatusBadge({ event }: { event: EventSummary }) {
  if (event.cancelled) {
    return <StatusChip label="Cancelled" tone="warning" testID={`status-${event.id}`} />;
  }
  if (!event.myRsvp) return null;
  return (
    <StatusChip
      label={RSVP_LABELS[event.myRsvp]}
      tone={RSVP_TONES[event.myRsvp]}
      testID={`status-${event.id}`}
    />
  );
}

export function DateBlock({ date }: { date: Date }) {
  const { month, day } = dateBlock(date);
  return (
    <View style={styles.dateBlock}>
      <AppText variant="caption" weight="700" color={colors.link}>
        {month}
      </AppText>
      <AppText variant="headline" weight="700">
        {day}
      </AppText>
    </View>
  );
}

/** One event in a grouped list: date block, title, time and place, RSVP state. */
export function EventRow({ event, showDate = true }: { event: EventSummary; showDate?: boolean }) {
  return (
    <ListRow
      title={event.title}
      subtitle={[formatTime(event.startsAt), event.location].filter(Boolean).join(' · ')}
      leading={showDate ? <DateBlock date={event.startsAt} /> : undefined}
      trailing={<StatusBadge event={event} />}
      showChevron
      onPress={() => openEvent(event.id)}
      testID={`event-${event.id}`}
    />
  );
}

const styles = StyleSheet.create({
  dateBlock: {
    width: MIN_TOUCH,
    height: MIN_TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
