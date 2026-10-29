import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchUpcomingEvents, type EventSummary } from '@/data/events';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import {
  AppText,
  Button,
  FilterChips,
  ListRow,
  ListSection,
  SearchField,
  StatusChip,
  type ChipTone,
} from '@/ui';

import {
  arrangeEvents,
  CATEGORY_FILTERS,
  CATEGORY_LABELS,
  dateBlock,
  emptyMessage,
  eventMeta,
  formatTime,
  RSVP_LABELS,
  type CategoryFilter,
} from './eventsLogic';

type State = { state: 'loading' } | { state: 'ready'; events: EventSummary[] } | { state: 'error' };

const RSVP_TONES: Record<NonNullable<EventSummary['myRsvp']>, ChipTone> = {
  going: 'success',
  maybe: 'gold',
  not_going: 'neutral',
};

function openEvent(id: string) {
  router.push({ pathname: '/events/[id]', params: { id } });
}

function StatusBadge({ event }: { event: EventSummary }) {
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

function FeaturedEvent({ event, now }: { event: EventSummary; now: Date }) {
  const label = [
    'Next up',
    event.title,
    eventMeta(event, now),
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
        <StatusBadge event={event} />
      </View>
    </Pressable>
  );
}

function DateBlock({ date }: { date: Date }) {
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

export function EventsScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const [value, setValue] = useState<State>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
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
    () => (value.state === 'ready' ? arrangeEvents(value.events, { category, search }) : null),
    [value, category, search],
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
        <AppText variant="largeTitle" accessibilityRole="header">
          Events
        </AppText>
        <SearchField
          value={search}
          onChangeText={setSearch}
          label="Search events"
          testID="events-search"
        />
        <FilterChips
          options={CATEGORY_FILTERS}
          value={category}
          onChange={setCategory}
          accessibilityLabel="Event category"
          testID="events-category"
        />

        {value.state === 'loading' ? (
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
                  <ListRow
                    key={event.id}
                    title={event.title}
                    subtitle={[formatTime(event.startsAt), event.location]
                      .filter(Boolean)
                      .join(' · ')}
                    leading={<DateBlock date={event.startsAt} />}
                    trailing={<StatusBadge event={event} />}
                    showChevron
                    onPress={() => openEvent(event.id)}
                    testID={`event-${event.id}`}
                  />
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
              {emptyMessage(category, search)}
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
  dateBlock: {
    width: MIN_TOUCH,
    height: MIN_TOUCH + spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { paddingTop: spacing.xxl, gap: spacing.sm, alignItems: 'center' },
});
