import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fetchDirectory, type DirectoryEntry } from '@/data/directory';
import { fetchWaitingCounts, type WaitingCounts } from '@/data/leadership';
import { fetchPrograms, type ProgramSummary } from '@/data/programs';
import { AnnouncementsSection } from '@/features/announcements/AnnouncementsSection';
import { RequireCapability, useCan, useRole } from '@/features/roles/RoleProvider';
import { roleLabel } from '@/features/roles/permissions';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Avatar, Chevron, ProgressRing } from '@/ui';

import { officersOf, progressSummary, waitingSummary } from './hubLogic';

type Icon = 'people' | 'chart' | 'calendar' | 'doc';

function TileIcon({ name }: { name: Icon }) {
  const d: Record<Icon, string> = {
    people:
      'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    calendar:
      'M7 3v3M17 3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5z',
    doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d={d[name]}
        stroke={palette.ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Tile({
  icon,
  label,
  note,
  onPress,
  testID,
}: {
  icon: Icon;
  label: string;
  note?: string;
  onPress?: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={note ? `${label}, ${note}` : label}
      accessibilityState={{ disabled: !onPress }}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, !onPress && styles.tileOff]}
      testID={testID}
    >
      <View style={styles.tileIcon}>
        <TileIcon name={icon} />
      </View>
      <AppText variant="subhead" weight="600">
        {label}
      </AppText>
      {note ? (
        <AppText variant="caption" color={colors.textSecondary}>
          {note}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function Card({
  children,
  onPress,
  label,
  testID,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={testID}
    >
      {children}
      <Chevron />
    </Pressable>
  );
}

/** The Chapter tab: leadership (officers), progress, shortcuts, announcements and officers. */
export function ChapterHubScreen() {
  const { label } = useRole();
  const canLead = useCan('leadership.view');
  const [programs, setPrograms] = useState<ProgramSummary[] | null>(null);
  const [directory, setDirectory] = useState<DirectoryEntry[] | null>(null);
  const [waiting, setWaiting] = useState<WaitingCounts | null>(null);

  // Refresh when the tab comes back into view, so counts stay current.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      fetchPrograms().then(
        (p) => live && setPrograms(p),
        () => live && setPrograms([]),
      );
      fetchDirectory().then(
        (d) => live && setDirectory(d),
        () => live && setDirectory([]),
      );
      if (canLead) {
        fetchWaitingCounts().then(
          (w) => live && setWaiting(w),
          () => {},
        );
      }
      return () => {
        live = false;
      };
    }, [canLead]),
  );

  const officers = officersOf(directory ?? []);
  const summary = programs ? progressSummary(programs) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Chapter
        </AppText>

        {/* Officers only. Members never see leadership tools, and the rules block them anyway. */}
        <RequireCapability capability="leadership.view">
          <Card
            onPress={() => router.push('/chapter/leadership')}
            label={`Leadership tools, ${label}${waiting ? `, ${waitingSummary(waiting)}` : ''}`}
            testID="leadership-entry"
          >
            <View style={styles.flex}>
              <AppText variant="headline">Leadership</AppText>
              <AppText variant="footnote" color={colors.textSecondary} testID="leadership-waiting">
                {waiting ? waitingSummary(waiting) : `Signed in as ${label}`}
              </AppText>
            </View>
            {waiting && waiting.membershipRequests + waiting.openReports > 0 ? (
              <View style={styles.badge} testID="leadership-badge">
                <AppText variant="caption" weight="700" color={palette.onInk}>
                  {String(waiting.membershipRequests + waiting.openReports)}
                </AppText>
              </View>
            ) : null}
          </Card>
        </RequireCapability>

        <Card
          onPress={() => router.push('/chapter/progress')}
          label={
            summary
              ? `Chapter progress, ${summary.percent} percent, ${summary.line}`
              : 'Chapter progress'
          }
          testID="progress-card"
        >
          <ProgressRing percent={summary?.percent ?? 0} size={56} />
          <View style={styles.flex}>
            <AppText variant="headline">Chapter progress</AppText>
            <AppText variant="footnote" color={colors.textSecondary} testID="progress-line">
              {summary ? summary.line : 'Loading…'}
            </AppText>
          </View>
        </Card>

        <View style={styles.tiles}>
          <Tile
            icon="people"
            label="Directory"
            onPress={() => router.push('/chapter/directory')}
            testID="directory-entry"
          />
          <Tile
            icon="chart"
            label="Programs"
            onPress={() => router.push('/chapter/progress')}
            testID="tile-programs"
          />
          <Tile
            icon="calendar"
            label="Calendar"
            onPress={() => router.push({ pathname: '/events', params: { view: 'calendar' } })}
            testID="tile-calendar"
          />
          <Tile icon="doc" label="Documents" note="Coming soon" testID="tile-documents" />
        </View>

        <AnnouncementsSection />
        <RequireCapability capability="announcements.post">
          <Pressable
            onPress={() => router.push('/chapter/announcements/new')}
            accessibilityRole="button"
            style={styles.link}
            testID="new-announcement"
          >
            <AppText variant="subhead" weight="600" color={colors.link}>
              New announcement
            </AppText>
          </Pressable>
        </RequireCapability>

        {officers.length > 0 ? (
          <View style={styles.officers}>
            <AppText
              variant="sectionHeader"
              color={colors.textSecondary}
              accessibilityRole="header"
              style={styles.inset}
            >
              OFFICERS
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.officerRow}
            >
              {officers.map((o) => (
                <Pressable
                  key={o.uid}
                  onPress={() =>
                    router.push({ pathname: '/chapter/member/[uid]', params: { uid: o.uid } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${o.displayName}, ${roleLabel(o.role)}`}
                  style={styles.officer}
                  testID={`officer-${o.uid}`}
                >
                  <Avatar name={o.displayName} uri={o.photoURL} size={52} />
                  <AppText variant="caption" weight="600" align="center" numberOfLines={1}>
                    {o.displayName.split(' ')[0]}
                  </AppText>
                  <AppText
                    variant="caption"
                    color={colors.textSecondary}
                    align="center"
                    numberOfLines={2}
                  >
                    {roleLabel(o.role)}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const TILE_GAP = spacing.sm;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  flex: { flex: 1, gap: spacing.xxs },
  pressed: { opacity: 0.8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    minHeight: MIN_TOUCH,
  },
  badge: {
    minWidth: spacing.xl + spacing.xxs,
    height: spacing.xl + spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
  tile: {
    width: `${50 - 1}%`,
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  tileOff: { opacity: 0.6 },
  tileIcon: {
    width: MIN_TOUCH - spacing.xs,
    height: MIN_TOUCH - spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: spacing.lg },
  officers: { gap: spacing.sm },
  inset: { paddingHorizontal: spacing.lg },
  officerRow: { gap: spacing.md, paddingHorizontal: spacing.xs },
  officer: { width: MIN_TOUCH * 2, alignItems: 'center', gap: spacing.xxs },
});
