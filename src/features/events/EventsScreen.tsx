import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchUpcomingEvents, type EventSummary } from '@/data/events';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, palette, radius, spacing } from '@/theme';
import {
  AppText,
  Button,
  IconButton,
  ListSection,
  PlusIcon,
  SearchField,
  SegmentedControl,
} from '@/ui';

import { CalendarView } from './CalendarView';

import { CoverageBar } from './CoverageBar';
import { EventRow, openEvent, StatusBadge } from './EventRow';
import {
  arrangeEvents,
  CATEGORY_LABELS,
  coverage,
  coverageLine,
  emptyMessage,
  eventMeta,
  RSVP_LABELS,
} from './eventsLogic';

type EventsView = 'upcoming' | 'calendar';

const VIEWS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'calendar', label: 'Calendar' },
] as const;

type State = { state: 'loading' } | { state: 'ready'; events: EventSummary[] } | { state: 'error' };

function FeaturedEvent({ event, now }: { event: EventSummary; now: Date }) {
  const covered = event.cancelled ? null : coverage(event);
  const label = [
    'Next up',
    event.title,
    eventMeta(event, now),
    covered ? coverageLine(covered) : '',
    event.myRsvp ? RSVP_LABELS[event.myRsvp] : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      onPress={() => openEvent(event.id)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
      testID="featured-event"
    >
      {event.photoURL ? (
        <Image source={{ uri: event.photoURL }} style={styles.hero} contentFit="cover" />
      ) : (
        <View style={[styles.hero, styles.heroBlank]}>
          <AppText variant="title2" color={palette.goldSoftText}>
            ΣΣΛ
          </AppText>
        </View>
      )}
      <View style={styles.featuredBody}>
        <AppText variant="caption" weight="700" color={colors.link}>
          NEXT UP · {CATEGORY_LABELS[event.category].toUpperCase()}
        </AppText>
        <AppText variant="title3">{event.title}</AppText>
        <AppText variant="subhead" color={colors.textSecondary}>
          {eventMeta(event, now)}
        </AppText>
        {covered ? <CoverageBar coverage={covered} testID="featured-coverage" /> : null}
        <StatusBadge event={event} />
      </View>
    </Pressable>
  );
}

export function EventsScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const [value, setValue] = useState<State>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  // The Chapter hub's Calendar tile opens /events?view=calendar.
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<EventsView>(
    params.view === 'calendar' ? 'calendar' : 'upcoming',
  );
  const [seenView, setSeenView] = useState(params.view);
  if (params.view !== seenView) {
    setSeenView(params.view);
    if (params.view === 'calendar') setView('calendar');
  }
  const [now, setNow] = useState(() => new Date());

  // Reload whenever the tab comes back into view, so an RSVP changed elsewhere shows here.
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let live = true;
      const at = new Date();
      fetchUpcomingEvents(uid, at).then(
        (events) => {
          if (!live) return;
          setNow(at);
          setValue({ state: 'ready', events });
          setRefreshing(false);
        },
        () => {
          if (!live) return;
          setValue((v) => (v.state === 'ready' ? v : { state: 'error' }));
          setRefreshing(false);
        },
      );
      return () => {
        live = false;
      };
      // reloadKey isn't read inside; bumping it is how pull to refresh and retry reload.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, reloadKey]),
  );

  const arranged = useMemo(
    () => (value.state === 'ready' ? arrangeEvents(value.events, search) : null),
    [value, search],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setReloadKey((n) => n + 1);
            }}
          />
        }
      >
        <View style={styles.titleRow}>
          <AppText variant="largeTitle" accessibilityRole="header">
            Events
          </AppText>
          {/* Any approved member can host an event. */}
          <IconButton
            label="New event"
            onPress={() => router.push('/events/new')}
            testID="new-event"
          >
            <PlusIcon />
          </IconButton>
        </View>
        <SearchField
          value={search}
          onChangeText={setSearch}
          label="Search events"
          testID="events-search"
        />
        <SegmentedControl
          segments={VIEWS}
          value={view}
          onChange={setView}
          accessibilityLabel="Events view"
          testID="events-view"
        />

        {view === 'calendar' ? (
          <CalendarView uid={uid} search={search} />
        ) : value.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : value.state === 'error' ? (
          <View style={styles.empty}>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Couldn’t load events.
            </AppText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setValue({ state: 'loading' });
                setReloadKey((n) => n + 1);
              }}
              testID="events-retry"
            />
          </View>
        ) : arranged && (arranged.featured || arranged.rest.length > 0) ? (
          <>
            {arranged.featured ? <FeaturedEvent event={arranged.featured} now={now} /> : null}
            {arranged.rest.length > 0 ? (
              <ListSection header="Coming up">
                {arranged.rest.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ListSection>
            ) : null}
          </>
        ) : (
          <View style={styles.empty} testID="events-empty">
            <AppText variant="headline" align="center">
              No events
            </AppText>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              {emptyMessage(search)}
            </AppText>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featured: {
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  hero: { width: '100%', aspectRatio: 16 / 9 },
  heroBlank: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBody: { padding: spacing.lg, gap: spacing.xs },
  empty: { paddingTop: spacing.xxl, gap: spacing.sm, alignItems: 'center' },
});
