import { router, useFocusEffect, useScrollToTop } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fetchDirectory, type DirectoryEntry } from '@/data/directory';
import { fetchWaitingCounts, type WaitingCounts } from '@/data/leadership';
import { fetchPrograms, type ProgramSummary } from '@/data/programs';
import { AnnouncementsSection } from '@/features/announcements/AnnouncementsSection';
import { useAuth } from '@/features/auth/AuthProvider';
import { openMember } from '@/features/profile/openMember';
import { percentDone } from '@/features/programs/programLogic';
import { RequireCapability, useCan, useRole } from '@/features/roles/RoleProvider';
import { roleLabel } from '@/features/roles/permissions';
import { colors, MIN_TOUCH, palette, radius, shadow, spacing } from '@/theme';
import { AppText, Avatar, Chevron, ProgressBar, ProgressRing, SectionTitle } from '@/ui';

import {
  hubPrograms,
  officersOf,
  programIcon,
  programMeta,
  progressSummary,
  waitingSummary,
  type ProgramIcon,
} from './hubLogic';

type Icon = ProgramIcon | 'shop' | 'calendar' | 'doc' | 'shield' | 'plus';

const PEOPLE =
  'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6';

const ICONS: Record<Icon, string> = {
  people: PEOPLE,
  shop: 'M4 10v10h16V10M3 10l1.5-5.5h15L21 10M3 10c0 1.4 1.1 2.5 2.5 2.5S8 11.4 8 10c0 1.4 1.1 2.5 2.5 2.5S13 11.4 13 10c0 1.4 1.1 2.5 2.5 2.5S18 11.4 18 10c0 1.4 1.1 2.5 2.5 2.5M10 20v-5h4v5',
  calendar:
    'M7 3v3M17 3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5z',
  doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 14h6',
  shield: 'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6zM9 12l2 2 4-4',
  plus: 'M12 5v14M5 12h14',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z',
  hands:
    'M12 11.5s-3-1.9-3-4.3a1.8 1.8 0 0 1 3-1.3 1.8 1.8 0 0 1 3 1.3c0 2.4-3 4.3-3 4.3zM3 13l3.5 6H11v-2.5c0-1.5-1.5-3-3.5-3.5M21 13l-3.5 6H13v-2.5c0-1.5 1.5-3 3.5-3.5',
  food: 'M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2.2 1-3.5 3.6-3.5 7.5H17',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z',
  flag: 'M5 21V4M5 4h12l-2.5 4L17 12H5',
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

/** One of the four tiles under the progress card. */
function Shortcut({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
      testID={testID}
    >
      <Glyph name={icon} size={SHORTCUT_ICON} />
      <AppText variant="footnote" weight="600" align="center" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** A program on the hub: its icon, committee and due date, a bar and its percent. */
function ProgramRow({ program, now }: { program: ProgramSummary; now: Date }) {
  const percent = percentDone(program.milestones);
  const meta = programMeta(program, now);
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/chapter/programs/[id]', params: { id: program.id } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${program.name}, ${meta}, ${percent} percent`}
      style={({ pressed }) => [styles.card, styles.programRow, pressed && styles.pressed]}
      testID={`program-${program.id}`}
    >
      <View style={styles.iconTile}>
        <Glyph name={programIcon(program.name)} color={colors.link} size={PROGRAM_ICON} />
      </View>
      <View style={styles.flex}>
        <AppText variant="headline" numberOfLines={1}>
          {program.name}
        </AppText>
        <AppText variant="subhead" color={colors.textSecondary} numberOfLines={1}>
          {meta}
        </AppText>
        <View style={styles.programBar}>
          <ProgressBar percent={percent} />
        </View>
      </View>
      <View style={styles.pill}>
        <AppText variant="subhead" weight="700" testID={`program-percent-${program.id}`}>
          {`${percent}%`}
        </AppText>
      </View>
    </Pressable>
  );
}

/** The Chapter tab: leadership (officers), progress, shortcuts, announcements, programs, officers. */
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
  const [now] = useState(() => new Date());

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
  const waitingCount = waiting ? waiting.membershipRequests + waiting.openReports : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <View style={styles.title}>
          <AppText variant="largeTitle" accessibilityRole="header">
            Chapter
          </AppText>
          <AppText variant="callout" color={colors.textSecondary}>
            Track progress, events, and chapter updates.
          </AppText>
        </View>

        {/* Officers only. Members never see leadership tools, and the rules block them anyway. */}
        <RequireCapability capability="leadership.view">
          <Pressable
            onPress={() => router.push('/chapter/leadership')}
            accessibilityRole="button"
            accessibilityLabel={`Leadership tools, ${label}${waiting ? `, ${waitingSummary(waiting)}` : ''}`}
            style={({ pressed }) => [styles.card, styles.leadRow, pressed && styles.pressed]}
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
          accessibilityLabel={
            summary
              ? `Chapter progress, ${summary.percent} percent, ${summary.line}`
              : 'Chapter progress'
          }
          style={({ pressed }) => [styles.card, styles.hero, pressed && styles.pressed]}
          testID="progress-card"
        >
          <ProgressRing percent={summary?.percent ?? 0} size={RING_SIZE} stroke={RING_STROKE} />
          <View style={styles.heroDivider} />
          <View style={styles.flex}>
            <AppText variant="title3">Chapter progress</AppText>
            <AppText variant="callout" color={colors.textSecondary} testID="progress-line">
              {summary ? summary.line : 'Loading…'}
            </AppText>
            <View style={styles.heroBar}>
              <ProgressBar percent={summary?.percent ?? 0} height={spacing.sm} />
            </View>
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

        {programs ? (
          <View style={styles.section}>
            <SectionTitle title="Program progress" />
            {programs.length === 0 ? (
              <View style={[styles.card, styles.empty]}>
                <AppText variant="callout" color={colors.textSecondary} testID="programs-empty">
                  No programs yet.
                </AppText>
              </View>
            ) : (
              hubPrograms(programs).map((p) => <ProgramRow key={p.id} program={p} now={now} />)
            )}
          </View>
        ) : null}

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
                  style={({ pressed }) => [styles.card, styles.officer, pressed && styles.pressed]}
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

const RING_SIZE = 104;
const RING_STROKE = 10;
const SHORTCUT_ICON = 28;
const PROGRAM_ICON = 26;
const ICON_TILE = 52;
const OFFICER_AVATAR = 56;
const RING = 2;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xxl, paddingBottom: spacing.xxxl },
  title: { gap: spacing.xs },
  flex: { flex: 1, gap: spacing.xxs },
  pressed: { opacity: 0.8 },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.sheet,
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.separator,
  },
  heroBar: { marginTop: spacing.md },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.fill,
    minHeight: MIN_TOUCH,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: spacing.xxxl,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  section: { gap: spacing.md },
  empty: { padding: spacing.lg },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  programBar: { marginTop: spacing.sm },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  // Officer cards scroll edge to edge, past the screen's side padding.
  bleed: { marginHorizontal: -spacing.lg },
  officerRow: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  officer: {
    width: OFFICER_AVATAR * 2,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  avatarRing: {
    padding: RING,
    borderWidth: RING,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
});
