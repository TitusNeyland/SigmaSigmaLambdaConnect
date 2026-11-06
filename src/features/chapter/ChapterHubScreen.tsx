import { router, useFocusEffect, useScrollToTop } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
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
import { AppText, Avatar, Chevron, ProgressRing, SectionTitle } from '@/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { openMember } from '@/features/profile/openMember';

import { chapterStats, officersOf, progressSummary, waitingSummary } from './hubLogic';

type Icon = 'people' | 'shop' | 'chart' | 'calendar' | 'doc' | 'shield' | 'plus';

const ICONS: Record<Icon, string> = {
  people:
    'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  shop: 'M4 10v10h16V10M3 10l1.5-5.5h15L21 10M3 10c0 1.4 1.1 2.5 2.5 2.5S8 11.4 8 10c0 1.4 1.1 2.5 2.5 2.5S13 11.4 13 10c0 1.4 1.1 2.5 2.5 2.5S18 11.4 18 10c0 1.4 1.1 2.5 2.5 2.5M10 20v-5h4v5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  calendar:
    'M7 3v3M17 3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5z',
  doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  shield: 'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6zM9 12l2 2 4-4',
  plus: 'M12 5v14M5 12h14',
};

function Glyph({
  name,
  color = palette.ink,
  size = 22,
}: {
  name: Icon;
  color?: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d={ICONS[name]}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** One of the round shortcuts under the progress card. Without onPress it's coming soon. */
function Shortcut({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: Icon;
  label: string;
  onPress?: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={onPress ? label : `${label}, Coming soon`}
      accessibilityState={{ disabled: !onPress }}
      style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={[styles.shortcutIcon, !onPress && styles.off]}>
        <Glyph name={icon} />
      </View>
      <AppText variant="caption" weight="600" align="center" numberOfLines={1}>
        {label}
      </AppText>
      {onPress ? null : (
        <AppText variant="caption" color={colors.textSecondary} align="center">
          Soon
        </AppText>
      )}
    </Pressable>
  );
}

/** The Chapter tab: leadership (officers), progress, shortcuts, announcements and officers. */
export function ChapterHubScreen() {
  const auth = useAuth();
  const me = auth.status === 'signedIn' ? auth.user.uid : '';
  // Tapping the tab again scrolls back to the top.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useScrollToTop(scroll);
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
  const stats = chapterStats({
    brothers: directory?.length ?? null,
    officers: directory ? officers.length : null,
    programs: programs?.length ?? null,
  });
  const waitingCount = waiting ? waiting.membershipRequests + waiting.openReports : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Chapter
        </AppText>

        {/* Officers only. Members never see leadership tools, and the rules block them anyway. */}
        <RequireCapability capability="leadership.view">
          <Pressable
            onPress={() => router.push('/chapter/leadership')}
            accessibilityRole="button"
            accessibilityLabel={`Leadership tools, ${label}${waiting ? `, ${waitingSummary(waiting)}` : ''}`}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            testID="leadership-entry"
          >
            <View style={styles.leadIcon}>
              <Glyph name="shield" color={palette.onInk} />
            </View>
            <View style={styles.flex}>
              <AppText variant="headline">Leadership</AppText>
              <AppText variant="footnote" color={colors.textSecondary} testID="leadership-waiting">
                {waiting ? waitingSummary(waiting) : `Signed in as ${label}`}
              </AppText>
            </View>
            {waitingCount > 0 ? (
              <View style={styles.badge} testID="leadership-badge">
                <AppText variant="caption" weight="700" color={palette.onInk}>
                  {String(waitingCount)}
                </AppText>
              </View>
            ) : null}
            <Chevron />
          </Pressable>
        </RequireCapability>

        <Pressable
          onPress={() => router.push('/chapter/progress')}
          accessibilityRole="button"
          accessibilityLabel={[
            summary
              ? `Chapter progress, ${summary.percent} percent, ${summary.line}`
              : 'Chapter progress',
            ...stats.filter((s) => s.value !== '–').map((s) => `${s.value} ${s.label}`),
          ].join(', ')}
          style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
          testID="progress-card"
        >
          <View style={styles.heroTop}>
            <ProgressRing percent={summary?.percent ?? 0} size={72} stroke={8} />
            <View style={styles.flex}>
              <AppText variant="title3">Chapter progress</AppText>
              <AppText variant="footnote" color={colors.textSecondary} testID="progress-line">
                {summary ? summary.line : 'Loading…'}
              </AppText>
            </View>
            <Chevron />
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.stats}>
            {stats.map((s, i) => (
              <View key={s.key} style={[styles.stat, i > 0 && styles.statDivider]}>
                <AppText variant="title2" testID={`stat-${s.key}`}>
                  {s.value}
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {s.label}
                </AppText>
              </View>
            ))}
          </View>
        </Pressable>

        <View style={styles.shortcuts}>
          <Shortcut
            icon="people"
            label="Directory"
            onPress={() => router.push('/chapter/directory')}
            testID="directory-entry"
          />
          <Shortcut
            icon="shop"
            label="Businesses"
            onPress={() => router.push('/chapter/businesses')}
            testID="tile-businesses"
          />
          <Shortcut
            icon="chart"
            label="Programs"
            onPress={() => router.push('/chapter/progress')}
            testID="tile-programs"
          />
          <Shortcut
            icon="calendar"
            label="Calendar"
            onPress={() => router.push({ pathname: '/events', params: { view: 'calendar' } })}
            testID="tile-calendar"
          />
          <Shortcut
            icon="doc"
            label="Documents"
            onPress={() => router.push('/chapter/documents')}
            testID="tile-documents"
          />
        </View>

        <AnnouncementsSection
          action={
            <RequireCapability capability="announcements.post">
              <Pressable
                onPress={() => router.push('/chapter/announcements/new')}
                accessibilityRole="button"
                accessibilityLabel="New announcement"
                hitSlop={spacing.sm}
                style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
                testID="new-announcement"
              >
                <Glyph name="plus" size={16} color={palette.onInk} />
                <AppText variant="subhead" weight="600" color={colors.textOnInk}>
                  New
                </AppText>
              </Pressable>
            </RequireCapability>
          }
        />

        {officers.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title="Officers" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.officerRow}
            >
              {officers.map((o) => (
                <Pressable
                  key={o.uid}
                  onPress={() => openMember(o.uid, me)}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.displayName}, ${roleLabel(o.role)}`}
                  style={({ pressed }) => [styles.officer, pressed && styles.pressed]}
                  testID={`officer-${o.uid}`}
                >
                  <View style={styles.avatarRing}>
                    <Avatar name={o.displayName} uri={o.photoURL} size={OFFICER_AVATAR} />
                  </View>
                  <AppText variant="subhead" weight="600" align="center" numberOfLines={1}>
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

const SHORTCUT_ICON = 52;
const OFFICER_AVATAR = 56;
const RING = 2;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  flex: { flex: 1, gap: spacing.xxs },
  pressed: { opacity: 0.8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    minHeight: MIN_TOUCH,
  },
  leadIcon: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  hero: {
    padding: spacing.xl,
    gap: spacing.lg,
    borderRadius: radius.sheet,
    backgroundColor: colors.surface,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.separator },
  shortcuts: {
    flexDirection: 'row',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  shortcut: { flex: 1, alignItems: 'center', gap: spacing.xs, minHeight: MIN_TOUCH },
  shortcutIcon: {
    width: SHORTCUT_ICON,
    height: SHORTCUT_ICON,
    borderRadius: SHORTCUT_ICON / 2,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  off: { opacity: 0.5 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: spacing.xxxl,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  section: { gap: spacing.xs },
  // Officer cards scroll edge to edge, past the screen's side padding.
  bleed: { marginHorizontal: -spacing.lg },
  officerRow: { gap: spacing.md, paddingHorizontal: spacing.lg },
  officer: {
    width: OFFICER_AVATAR * 2,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  avatarRing: {
    padding: RING,
    borderWidth: RING,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
});
