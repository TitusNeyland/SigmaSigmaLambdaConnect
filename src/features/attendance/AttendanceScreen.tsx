import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fetchRoster, saveAttendance, type Roster, type RosterEntry } from '@/data/attendance';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDay, formatTime } from '@/features/events/eventsLogic';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import {
  AppText,
  Avatar,
  Button,
  NavHeader,
  ProgressBar,
  SearchField,
  SegmentedControl,
  SwitchRow,
  TextField,
} from '@/ui';

import {
  attendanceChanges,
  checkInSummary,
  hasChanges,
  isRsvpd,
  parseHours,
  savedHours,
  savedMessage,
  visibleRoster,
  type RosterFilter,
} from './attendanceLogic';

type Loaded =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'missing' }
  | { state: 'ready'; roster: Roster };

const FILTERS = [
  { value: 'rsvpd', label: 'RSVP’d' },
  { value: 'all', label: 'Everyone' },
] as const satisfies readonly { value: RosterFilter; label: string }[];

const RSVP_LABELS = { going: 'Going', maybe: 'Maybe', not_going: 'Can’t go' } as const;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter/attendance');
}

function Check({ on }: { on: boolean }) {
  return (
    <View style={[styles.check, on && styles.checkOn]}>
      {on ? (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
          <Path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke={palette.onInk}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

function MemberRow({
  member,
  checked,
  onToggle,
}: {
  member: RosterEntry;
  checked: boolean;
  onToggle: () => void;
}) {
  const walkIn = checked && !isRsvpd(member);
  const note = [member.rsvp ? RSVP_LABELS[member.rsvp] : 'No RSVP', walkIn ? 'Walk-in' : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${member.displayName}, ${note}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`roster-${member.uid}`}
    >
      <Avatar name={member.displayName} uri={member.photoURL} size={36} />
      <View style={styles.flex}>
        <AppText variant="body">{member.displayName}</AppText>
        <AppText variant="footnote" color={colors.textSecondary}>
          {note}
        </AppText>
      </View>
      <Check on={checked} />
    </Pressable>
  );
}

/** Officers check brothers in at one event, optionally logging service hours. */
export function AttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const canAttend = useCan('attendance.take');

  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState<RosterFilter>('rsvpd');
  const [search, setSearch] = useState('');
  const [logHours, setLogHours] = useState(false);
  const [hoursText, setHoursText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!canAttend || !id) return;
    let live = true;
    fetchRoster(id).then(
      (roster) => {
        if (!live) return;
        if (!roster) {
          setLoaded({ state: 'missing' });
          return;
        }
        const hours = savedHours(roster.members);
        setChecked(new Set(roster.members.filter((m) => m.checkedIn).map((m) => m.uid)));
        setLogHours(hours !== null);
        setHoursText(hours === null ? '' : String(hours));
        setLoaded({ state: 'ready', roster });
      },
      () => live && setLoaded({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [canAttend, id, attempt]);

  const members = useMemo(() => (loaded.state === 'ready' ? loaded.roster.members : []), [loaded]);
  const hours = logHours ? parseHours(hoursText) : null;
  const hoursInvalid = logHours && hours === null;
  const changes = attendanceChanges(members, checked, hours);
  const summary = checkInSummary(members, checked);
  const shown = visibleRoster(members, checked, filter, search);

  function toggle(memberId: string) {
    setSaved(null);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  async function save() {
    if (loaded.state !== 'ready' || saving || hoursInvalid || !hasChanges(changes)) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveAttendance(loaded.roster.event.id, uid, changes);
      // What's saved is now the starting point, so another save only sends new changes.
      const roster = {
        ...loaded.roster,
        members: loaded.roster.members.map((m) => {
          const here = checked.has(m.uid);
          const rewritten = changes.checkIn.some((c) => c.uid === m.uid);
          return {
            ...m,
            checkedIn: here,
            serviceHours: here ? (rewritten ? hours : m.serviceHours) : null,
          };
        }),
      };
      setLoaded({ state: 'ready', roster });
      setSaved(savedMessage(summary.checkedIn, hours));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  if (!canAttend) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <NavHeader onBack={goBack} backTestID="attendance-back" />
        <View style={styles.content}>
          <AppText variant="callout" color={colors.textSecondary} testID="attendance-denied">
            Only officers can see this.
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBack} backTestID="attendance-back" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loaded.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : loaded.state === 'missing' ? (
          <AppText variant="callout" color={colors.textSecondary} testID="attendance-missing">
            This event isn’t available anymore.
          </AppText>
        ) : loaded.state === 'error' ? (
          <View style={styles.center}>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Couldn’t load the roster.
            </AppText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setLoaded({ state: 'loading' });
                setAttempt((n) => n + 1);
              }}
              testID="attendance-retry"
            />
          </View>
        ) : (
          <>
            <View style={styles.titleBlock}>
              <AppText variant="largeTitle" accessibilityRole="header">
                Attendance
              </AppText>
              <AppText variant="subhead" color={colors.textSecondary}>
                {loaded.roster.event.title} · {formatDay(loaded.roster.event.startsAt, now)} ·{' '}
                {formatTime(loaded.roster.event.startsAt)}
              </AppText>
            </View>

            <View style={styles.card}>
              <AppText variant="headline" testID="checkin-line">
                {summary.line}
              </AppText>
              <ProgressBar
                percent={summary.percent}
                accessibilityLabel={`${summary.checkedIn} checked in of ${summary.going} going`}
                testID="checkin-bar"
              />
            </View>

            <SearchField
              value={search}
              onChangeText={setSearch}
              label="Search brothers"
              testID="roster-search"
            />
            <SegmentedControl
              segments={FILTERS}
              value={filter}
              onChange={setFilter}
              accessibilityLabel="Who to show"
              testID="roster-filter"
            />

            <View style={styles.list}>
              {shown.length === 0 ? (
                <View style={styles.emptyRow}>
                  <AppText
                    variant="callout"
                    color={colors.textSecondary}
                    align="center"
                    testID="roster-empty"
                  >
                    {search
                      ? 'No one matches that.'
                      : 'No RSVPs yet. Switch to Everyone to check people in.'}
                  </AppText>
                </View>
              ) : (
                shown.map((m) => (
                  <MemberRow
                    key={m.uid}
                    member={m}
                    checked={checked.has(m.uid)}
                    onToggle={() => toggle(m.uid)}
                  />
                ))
              )}
            </View>
            {filter === 'rsvpd' ? (
              <Button
                title="Add walk-in"
                variant="plain"
                onPress={() => setFilter('all')}
                testID="add-walk-in"
              />
            ) : null}

            <View style={styles.list}>
              <SwitchRow
                title="Log service hours"
                subtitle="Same hours for everyone checked in"
                value={logHours}
                onValueChange={(v) => {
                  setSaved(null);
                  setLogHours(v);
                }}
                testID="log-hours"
              />
            </View>
            {logHours ? (
              <TextField
                label="Hours each"
                value={hoursText}
                onChangeText={(t) => {
                  setSaved(null);
                  setHoursText(t);
                }}
                keyboardType="decimal-pad"
                error={hoursText && hoursInvalid ? 'Enter hours from 0.5 to 24.' : undefined}
                testID="hours-each"
              />
            ) : null}

            {saved ? (
              <AppText
                variant="subhead"
                weight="600"
                color={colors.success}
                accessibilityLiveRegion="polite"
                testID="attendance-saved"
              >
                {saved}
              </AppText>
            ) : null}
            {failed ? (
              <AppText variant="footnote" color={colors.destructive} testID="attendance-failed">
                Couldn’t save. Check your connection and try again.
              </AppText>
            ) : null}
            <Button
              title="Save attendance"
              onPress={save}
              loading={saving}
              disabled={hoursInvalid || !hasChanges(changes)}
              fullWidth
              testID="attendance-save"
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },
  center: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  titleBlock: { gap: spacing.xxs },
  flex: { flex: 1, gap: spacing.xxs },
  pressed: { opacity: 0.7 },
  card: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  list: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    gap: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
    backgroundColor: colors.surface,
  },
  emptyRow: { padding: spacing.lg, backgroundColor: colors.surface },
  check: {
    width: spacing.xl + spacing.xs,
    height: spacing.xl + spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: palette.ink, borderColor: palette.ink },
});
