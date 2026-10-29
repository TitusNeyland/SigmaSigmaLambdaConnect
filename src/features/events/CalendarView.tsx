import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fetchEventsBetween, type EventSummary } from '@/data/events';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Button, ListSection } from '@/ui';

import {
  addMonths,
  dayKey,
  defaultDay,
  eventsByDay,
  longDay,
  monthGrid,
  monthOf,
  monthRange,
  monthTitle,
  WEEKDAYS,
  type Month,
} from './calendarLogic';
import { EventRow } from './EventRow';
import { matchesSearch, type CategoryFilter } from './eventsLogic';

type Loaded =
  { key: string; state: 'ready'; events: EventSummary[] } | { key: string; state: 'error' };

const monthKey = (m: Month) => `${m.year}-${m.month}`;

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}
        stroke={colors.text}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export type CalendarViewProps = {
  uid: string;
  category: CategoryFilter;
  search: string;
  /** Injected in tests; defaults to now. */
  today?: Date;
};

/** Month calendar with gold dots on event days. Tapping a day lists its events below. */
export function CalendarView({ uid, category, search, today: todayProp }: CalendarViewProps) {
  const [today] = useState(() => todayProp ?? new Date());
  const [month, setMonth] = useState<Month>(() => monthOf(today));
  const [picked, setPicked] = useState<{ key: string; day: Date } | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = monthKey(month);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let live = true;
      const { from, to } = monthRange(month);
      fetchEventsBetween(uid, from, to).then(
        (events) => live && setLoaded({ key, state: 'ready', events }),
        () => live && setLoaded({ key, state: 'error' }),
      );
      return () => {
        live = false;
      };
      // attempt isn't read inside; bumping it is how Try again reloads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, key, attempt]),
  );

  const current = loaded?.key === key ? loaded : null;
  const byDay = useMemo(
    () =>
      eventsByDay(
        current?.state === 'ready'
          ? current.events
              .filter((e) => category === 'all' || e.category === category)
              .filter((e) => matchesSearch(e, search))
          : [],
      ),
    [current, category, search],
  );

  const selected = picked?.key === key ? picked.day : defaultDay(month, today, byDay);
  const selectedEvents = byDay.get(dayKey(selected)) ?? [];
  const todayKey = dayKey(today);

  function go(delta: number) {
    setMonth((m) => addMonths(m, delta));
  }

  return (
    <View style={styles.wrap} testID="calendar">
      <View style={styles.card}>
        <View style={styles.monthRow}>
          <Pressable
            onPress={() => go(-1)}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={styles.arrow}
            testID="month-prev"
          >
            <Arrow direction="left" />
          </Pressable>
          <AppText variant="headline" accessibilityRole="header" testID="month-title">
            {monthTitle(month)}
          </AppText>
          <Pressable
            onPress={() => go(1)}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={styles.arrow}
            testID="month-next"
          >
            <Arrow direction="right" />
          </Pressable>
        </View>

        <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no">
          {WEEKDAYS.map((d, i) => (
            <AppText
              key={i}
              variant="caption"
              weight="600"
              color={colors.textSecondary}
              align="center"
              style={styles.cell}
            >
              {d}
            </AppText>
          ))}
        </View>

        {monthGrid(month).map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((date, i) => {
              if (!date) return <View key={i} style={styles.cell} />;
              const k = dayKey(date);
              const count = byDay.get(k)?.length ?? 0;
              const isSelected = k === dayKey(selected);
              const isToday = k === todayKey;
              return (
                <Pressable
                  key={i}
                  onPress={() => setPicked({ key, day: date })}
                  accessibilityRole="button"
                  accessibilityLabel={`${longDay(date)}${
                    count ? `, ${count} ${count === 1 ? 'event' : 'events'}` : ''
                  }`}
                  accessibilityState={{ selected: isSelected }}
                  style={styles.cell}
                  testID={`day-${k}`}
                >
                  <View style={[styles.dayCircle, isSelected && styles.daySelected]}>
                    <AppText
                      variant="callout"
                      weight={isSelected || isToday ? '700' : '400'}
                      color={isSelected ? colors.textOnInk : isToday ? colors.link : colors.text}
                    >
                      {String(date.getDate())}
                    </AppText>
                  </View>
                  <View
                    style={[styles.dot, count > 0 && styles.dotOn]}
                    testID={count > 0 ? `dot-${k}` : undefined}
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {!current ? (
        <AppText variant="callout" color={colors.textSecondary} align="center">
          Loading…
        </AppText>
      ) : current.state === 'error' ? (
        <View style={styles.message}>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Couldn’t load this month.
          </AppText>
          <Button
            title="Try again"
            variant="secondary"
            onPress={() => setAttempt((n) => n + 1)}
            testID="calendar-retry"
          />
        </View>
      ) : selectedEvents.length > 0 ? (
        <ListSection header={longDay(selected)}>
          {selectedEvents.map((event) => (
            <EventRow key={event.id} event={event} showDate={false} />
          ))}
        </ListSection>
      ) : (
        <View style={styles.message} testID="day-empty">
          <AppText variant="subhead" weight="600" align="center">
            {longDay(selected)}
          </AppText>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            No events this day.
          </AppText>
        </View>
      )}
    </View>
  );
}

const CELL = MIN_TOUCH;

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  cell: { flex: 1, minHeight: CELL + spacing.sm, alignItems: 'center', justifyContent: 'center' },
  dayCircle: {
    width: CELL - spacing.sm,
    height: CELL - spacing.sm,
    borderRadius: (CELL - spacing.sm) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.primary },
  dot: {
    width: spacing.xs + 1,
    height: spacing.xs + 1,
    borderRadius: radius.pill,
    marginTop: spacing.xxs,
  },
  dotOn: { backgroundColor: palette.gold },
  message: { paddingTop: spacing.lg, gap: spacing.sm, alignItems: 'center' },
});
