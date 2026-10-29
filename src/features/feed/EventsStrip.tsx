import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { EventSummary } from '@/data/events';
import { colors, radius, spacing } from '@/theme';
import { AppText } from '@/ui';

import { dateBlock, formatDay, formatTime } from '@/features/events/eventsLogic';

/** How many upcoming events the Home strip shows before "See all". */
export const STRIP_LIMIT = 6;

/** Horizontal cards for the next few events, at the top of Home. Hidden when there are none. */
export function EventsStrip({ events, now }: { events: EventSummary[]; now: Date }) {
  const shown = events.filter((e) => !e.cancelled).slice(0, STRIP_LIMIT);
  if (shown.length === 0) return null;
  return (
    <View style={styles.wrap} testID="events-strip">
      <View style={styles.head}>
        <AppText variant="headline">Upcoming</AppText>
        <Pressable
          onPress={() => router.push('/events')}
          accessibilityRole="button"
          hitSlop={spacing.sm}
          testID="events-strip-all"
        >
          <AppText variant="subhead" color={colors.link}>
            See all
          </AppText>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {shown.map((event) => {
          const { month, day } = dateBlock(event.startsAt);
          const when = `${formatDay(event.startsAt, now)}, ${formatTime(event.startsAt)}`;
          return (
            <Pressable
              key={event.id}
              onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${event.title}, ${when}`}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              testID={`strip-event-${event.id}`}
            >
              <AppText variant="caption" weight="700" color={colors.link}>
                {month} {day}
              </AppText>
              <AppText variant="subhead" weight="600" numberOfLines={2}>
                {event.title}
              </AppText>
              <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
                {formatTime(event.startsAt)}
                {event.location ? ` · ${event.location}` : ''}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, paddingVertical: spacing.md },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: {
    width: spacing.xxxl * 5,
    padding: spacing.md,
    gap: spacing.xxs,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundGrouped,
  },
  pressed: { opacity: 0.8 },
});
