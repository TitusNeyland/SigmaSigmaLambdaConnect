import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  markRead,
  subscribeToAnnouncements,
  subscribeToReads,
  type ChapterAnnouncement,
} from '@/data/announcements';
import { useAuth } from '@/features/auth/AuthProvider';
import { timeAgo } from '@/features/feed/feedLogic';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText } from '@/ui';

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
export function AnnouncementsSection({ onUnreadChange }: { onUnreadChange?: (n: number) => void }) {
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
      <AppText
        variant="sectionHeader"
        color={colors.textSecondary}
        accessibilityRole="header"
        style={styles.header}
      >
        {unread > 0 ? `ANNOUNCEMENTS · ${unread} NEW` : 'ANNOUNCEMENTS'}
      </AppText>
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
          <AppText
            variant="callout"
            color={colors.textSecondary}
            style={styles.message}
            testID="announcements-empty"
          >
            No announcements yet.
          </AppText>
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

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: { paddingHorizontal: spacing.lg },
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
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
});
