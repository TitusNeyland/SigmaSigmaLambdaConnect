import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  photoUrl,
  type ActivityItem,
  type Profile,
  type ProfilePost,
  type ProfileStats,
} from '@/data/profile';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';
import { AppText, Avatar, Button, SegmentedControl, StatusChip } from '@/ui';

import type { Loadable } from './useProfileData';

type Tab = 'posts' | 'activity';

export type ProfileViewProps = {
  profile: Profile;
  /** Officer title or role label. Hidden for regular members. */
  roleLabel: string | null;
  stats: Loadable<ProfileStats>;
  posts: Loadable<ProfilePost[]>;
  /** Null when the viewer isn't allowed to see attendance; the Activity tab is hidden. */
  activity: Loadable<ActivityItem[] | null>;
  /** Shown under the avatar row, e.g. Edit profile. */
  actions?: ReactNode;
  /** Gold ring around the photo on the member's own profile. */
  own?: boolean;
  onRefresh: () => void;
  refreshing?: boolean;
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "Software engineer · Initiated Spring 2019", leaving out whatever is missing. */
export function profileSubtitle(profile: Pick<Profile, 'headline' | 'initiationTerm'>): string {
  return [
    profile.headline.trim(),
    profile.initiationTerm.trim() && `Initiated ${profile.initiationTerm.trim()}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} service ${rounded === 1 ? 'hour' : 'hours'}`;
}

function Stat({
  value,
  label,
  testID,
}: {
  value: Loadable<number | null>;
  label: string;
  testID: string;
}) {
  const shown = value.state === 'ready' ? String(value.data ?? '') : '–';
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${shown} ${label}`} testID={testID}>
      <AppText variant="headline" weight="700">
        {shown}
      </AppText>
      <AppText variant="footnote" color={colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

function pick<T, K extends keyof T>(value: Loadable<T>, key: K): Loadable<T[K]> {
  return value.state === 'ready' ? { state: 'ready', data: value.data[key] } : value;
}

const GRID_COLUMNS = 3;
const GRID_GAP = spacing.xxs;

/** Tile edge for a grid this wide: three equal squares with two gaps between them. */
export function gridTileSize(gridWidth: number): number {
  return Math.floor((gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
}

/**
 * Three square tiles per row, Instagram style. Sized from the measured width, because
 * percentage widths plus gaps overflow the row and aspectRatio doesn't hold up in a
 * wrapping row.
 */
function PostGrid({ posts }: { posts: ProfilePost[] }) {
  // The grid runs edge to edge, so the screen width is right until it's measured.
  const screen = useWindowDimensions().width;
  const [width, setWidth] = useState<number | null>(null);
  const size = gridTileSize(width ?? screen);
  return (
    <View
      style={styles.grid}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      testID="profile-grid"
    >
      {posts.map((post) => (
        <PostTile key={post.id} post={post} size={size} />
      ))}
    </View>
  );
}

function PostTile({ post, size }: { post: ProfilePost; size: number }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (!post.coverPath) return;
    let cancelled = false;
    photoUrl(post.coverPath).then(
      (url) => !cancelled && setUri(url),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [post.coverPath]);

  return (
    <View style={[styles.tile, { width: size, height: size }]} testID={`profile-post-${post.id}`}>
      {post.coverPath ? (
        uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityLabel={post.caption || 'Photo post'}
          />
        ) : null
      ) : (
        <AppText
          variant="caption"
          color={colors.textSecondary}
          numberOfLines={4}
          style={styles.tileText}
        >
          {post.caption}
        </AppText>
      )}
    </View>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const date = item.startsAt;
  const meta = [item.location, item.serviceHours > 0 ? formatHours(item.serviceHours) : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.activityRow} testID={`activity-${item.eventId}`}>
      <View style={styles.dateBlock}>
        <AppText variant="caption" weight="700" color={colors.link}>
          {date ? MONTHS[date.getMonth()] : ''}
        </AppText>
        <AppText variant="headline" weight="700">
          {date ? String(date.getDate()) : ''}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="callout" weight="600">
          {item.title}
        </AppText>
        {meta ? (
          <AppText variant="footnote" color={colors.textSecondary}>
            {meta}
          </AppText>
        ) : null}
      </View>
      <AppText variant="footnote" weight="600" color={colors.link}>
        Attended
      </AppText>
    </View>
  );
}

function Message({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={styles.message}>
      <AppText variant="callout" color={colors.textSecondary} align="center">
        {text}
      </AppText>
      {onRetry ? <Button title="Try again" variant="plain" size="small" onPress={onRetry} /> : null}
    </View>
  );
}

export function ProfileView({
  profile,
  roleLabel,
  stats,
  posts,
  activity,
  actions,
  own = false,
  onRefresh,
  refreshing = false,
}: ProfileViewProps) {
  const [tab, setTab] = useState<Tab>('posts');
  const showActivity = !(activity.state === 'ready' && activity.data === null);
  const current: Tab = showActivity ? tab : 'posts';
  const subtitle = profileSubtitle(profile);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      testID="profile-scroll"
    >
      <View style={styles.top}>
        <Avatar name={profile.displayName} uri={profile.photoURL} size={86} ring={own} />
        <View style={styles.stats}>
          <Stat value={pick(stats, 'posts')} label="Posts" testID="stat-posts" />
          <Stat value={pick(stats, 'eventsAttended')} label="Events" testID="stat-events" />
          <Stat value={pick(stats, 'serviceHours')} label="Service hrs" testID="stat-hours" />
        </View>
      </View>

      <View style={styles.about}>
        <AppText variant="headline" weight="700" accessibilityRole="header">
          {profile.displayName}
        </AppText>
        {subtitle ? (
          <AppText variant="subhead" color={colors.textSecondary}>
            {subtitle}
          </AppText>
        ) : null}
        {profile.bio ? <AppText variant="subhead">{profile.bio}</AppText> : null}
        {roleLabel || profile.interests.length > 0 ? (
          <View style={styles.chips}>
            {roleLabel ? <StatusChip label={roleLabel} tone="gold" testID="role-chip" /> : null}
            {profile.interests.map((interest) => (
              <StatusChip key={interest} label={interest} tone="neutral" />
            ))}
          </View>
        ) : null}
      </View>

      {actions ? <View style={styles.actions}>{actions}</View> : null}

      {showActivity ? (
        <SegmentedControl
          segments={[
            { value: 'posts', label: 'Posts' },
            { value: 'activity', label: 'Activity' },
          ]}
          value={current}
          onChange={setTab}
          accessibilityLabel="Profile sections"
          testID="profile-tabs"
        />
      ) : null}

      {current === 'posts' ? (
        posts.state === 'loading' ? (
          <Message text="Loading posts…" />
        ) : posts.state === 'error' ? (
          <Message text="Couldn’t load posts." onRetry={onRefresh} />
        ) : posts.data.length === 0 ? (
          <Message text={own ? 'Your posts will show up here.' : 'No posts yet.'} />
        ) : (
          <PostGrid posts={posts.data} />
        )
      ) : (
        <View testID="profile-activity">
          {activity.state === 'loading' ? (
            <Message text="Loading activity…" />
          ) : activity.state === 'error' ? (
            <Message text="Couldn’t load activity." onRetry={onRefresh} />
          ) : activity.data && activity.data.length > 0 ? (
            activity.data.map((item) => <ActivityRow key={item.eventId} item={item} />)
          ) : (
            <Message
              text={own ? 'Events you’re checked in at will show up here.' : 'No check-ins yet.'}
            />
          )}
          <AppText variant="caption" color={colors.textSecondary} style={styles.privacy}>
            {own
              ? 'Only you and chapter officers can see your attendance history.'
              : 'Only this brother and chapter officers can see his attendance history.'}
          </AppText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxl },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: spacing.xxs },
  about: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginHorizontal: -spacing.xl },
  tile: {
    backgroundColor: colors.fill,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  tileText: { padding: spacing.sm },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  dateBlock: {
    width: MIN_TOUCH,
    height: MIN_TOUCH + spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: spacing.xxs },
  message: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: spacing.sm },
  privacy: { paddingTop: spacing.md },
});
