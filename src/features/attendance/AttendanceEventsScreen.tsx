import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchAttendanceEvents, type AttendanceEvent } from '@/data/attendance';
import { formatDay, formatTime } from '@/features/events/eventsLogic';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, spacing } from '@/theme';
import { AppText, Button, ListRow, ListSection, NavHeader } from '@/ui';

type Loaded =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; events: AttendanceEvent[]; now: Date };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter/leadership');
}

/** Pick the event to take attendance for: the last two weeks through tomorrow. */
export function AttendanceEventsScreen() {
  const canAttend = useCan('attendance.take');
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!canAttend) return;
      let live = true;
      const now = new Date();
      fetchAttendanceEvents(now).then(
        (events) => live && setLoaded({ state: 'ready', events, now }),
        () => live && setLoaded({ state: 'error' }),
      );
      return () => {
        live = false;
      };
      // attempt isn't read; bumping it is how Try again reloads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canAttend, attempt]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="attendance-events-back" />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Take attendance
        </AppText>
        {!canAttend ? (
          <AppText variant="callout" color={colors.textSecondary} testID="attendance-denied">
            Only officers can see this.
          </AppText>
        ) : loaded.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : loaded.state === 'error' ? (
          <View style={styles.center}>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Couldn’t load events.
            </AppText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setLoaded({ state: 'loading' });
                setAttempt((n) => n + 1);
              }}
              testID="attendance-events-retry"
            />
          </View>
        ) : loaded.events.length === 0 ? (
          <AppText
            variant="callout"
            color={colors.textSecondary}
            align="center"
            testID="attendance-events-empty"
          >
            No events in the last two weeks or tomorrow.
          </AppText>
        ) : (
          <ListSection header="Pick an event">
            {loaded.events.map((e) => (
              <ListRow
                key={e.id}
                title={e.title}
                subtitle={[
                  `${formatDay(e.startsAt, loaded.now)} · ${formatTime(e.startsAt)}`,
                  e.location,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() =>
                  router.push({ pathname: '/chapter/attendance/[id]', params: { id: e.id } })
                }
                testID={`attendance-event-${e.id}`}
              />
            ))}
          </ListSection>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },
  center: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
});
