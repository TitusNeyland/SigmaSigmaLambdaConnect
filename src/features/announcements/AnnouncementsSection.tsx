import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  markRead,
  subscribeToAnnouncements,
  subscribeToReads,
  type ChapterAnnouncement,
} from '@/data/announcements';
import { useAuth } from '@/features/auth/AuthProvider';
import { timeAgo } from '@/features/feed/feedLogic';
import { colors, MIN_TOUCH, palette, radius, shadow, spacing } from '@/theme';
import { AppText, SectionTitle, StatusChip } from '@/ui';

import { sortAnnouncements } from './announcementLogic';

function Row({
  announcement,
  unread,
  now,
  onOpen,
}: {
  announcement: ChapterAnnouncement;
  unread: boolean;
  now: Date;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = [
    announcement.pinned ? 'Pinned' : '',
    announcement.authorTitle,
    timeAgo(announcement.createdAt, now),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => {
        setOpen((o) => !o);
        if (unread) onOpen();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${announcement.title}, ${meta}`}
      accessibilityState={{ expanded: open }}
      style={styles.row}
      testID={`announcement-${announcement.id}`}
    >
      <View
        style={[styles.dot, unread && styles.dotOn]}
        testID={unread ? `unread-${announcement.id}` : undefined}
      />
      <View style={styles.flex}>
        <AppText variant="subhead" weight={unread ? '700' : '600'}>
          {announcement.title}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {meta}
        </AppText>
        {open ? (
          <AppText
            variant="subhead"
            style={styles.body}
            testID={`announcement-body-${announcement.id}`}
          >
            {announcement.body}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Chapter announcements with unread dots. Tapping one expands it and marks it read. Shows
 * nothing when there are none and nothing to say.
 */
export function AnnouncementsSection({
  onUnreadChange,
  action,
}: {
  onUnreadChange?: (n: number) => void;
  /** Beside the heading, e.g. the officers' New button. */
  action?: ReactNode;
}) {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const [list, setList] = useState<ChapterAnnouncement[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reads, setReads] = useState<ReadonlySet<string>>(new Set());
  const [now] = useState(() => new Date());

  useEffect(() => subscribeToAnnouncements(setList, () => setFailed(true)), []);
  useEffect(() => {
    if (!uid) return;
    return subscribeToReads(uid, setReads, () => {});
  }, [uid]);

  const sorted = useMemo(() => sortAnnouncements(list ?? []), [list]);
  const unread = sorted.filter((a) => !reads.has(a.id)).length;
  useEffect(() => onUnreadChange?.(unread), [unread, onUnreadChange]);

  return (
    <View style={styles.wrap} testID="announcements">
      <SectionTitle
        title="Announcements"
        badge={
          unread > 0 ? (
            <StatusChip label={`${unread} new`} tone="gold" testID="announcements-unread" />
          ) : null
        }
        trailing={action}
      />
      <View style={styles.card}>
        {failed ? (
          <AppText variant="callout" color={colors.textSecondary} style={styles.message}>
            Couldn’t load announcements.
          </AppText>
        ) : list === null ? (
          <AppText variant="callout" color={colors.textSecondary} style={styles.message}>
            Loading…
          </AppText>
        ) : sorted.length === 0 ? (
          <View style={styles.empty} testID="announcements-empty">
            <View style={styles.emptyIcon}>
              <Svg
                width={EMPTY_ICON}
                height={EMPTY_ICON}
                viewBox="0 0 24 24"
                fill="none"
                accessibilityElementsHidden
              >
                <Path
                  d={MEGAPHONE}
                  stroke={colors.link}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={styles.flex}>
              <AppText variant="subhead" weight="700">
                No announcements yet.
              </AppText>
              <AppText variant="footnote" color={colors.textSecondary}>
                Check back soon for chapter updates.
              </AppText>
            </View>
          </View>
        ) : (
          sorted.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <View style={styles.separator} /> : null}
              <Row
                announcement={a}
                unread={!reads.has(a.id)}
                now={now}
                onOpen={() => {
                  markRead(uid, a.id).catch(() => {});
                }}
              />
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const MEGAPHONE =
  'M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1zM7 15l1 4.5M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11';
const EMPTY_ICON = 24;
const EMPTY_TILE = 48;

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: MIN_TOUCH,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.pill,
    marginTop: spacing.xs + 2,
  },
  dotOn: { backgroundColor: palette.gold },
  flex: { flex: 1, gap: spacing.xxs },
  body: { marginTop: spacing.xs },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginLeft: spacing.xxxl,
  },
  message: { padding: spacing.lg },
  empty: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg },
  emptyIcon: {
    width: EMPTY_TILE,
    height: EMPTY_TILE,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
