import { Image } from 'expo-image';
import { useEffect, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import type { EventSummary } from '@/data/events';
import {
  photoUrl,
  type ActivityItem,
  type Profile,
  type ProfilePost,
  type ProfileStats,
} from '@/data/profile';
import { colors, MIN_TOUCH, motion, palette, radius, spacing } from '@/theme';
import { AppText, Avatar, Button, SegmentedControl, StatusChip } from '@/ui';

import { timeAgo } from '@/features/feed/feedLogic';

import { businessLine, industryLine } from './aboutYou';
import { GridSkeleton } from './ProfileSkeleton';
import { buildTimeline, type TimelineItem } from './timelineLogic';
import type { Loadable } from './useProfileData';

type Tab = 'photos' | 'text' | 'tagged' | 'activity';

export type ProfileViewProps = {
  profile: Profile;
  /** Officer title or role label. Hidden for regular members. */
  roleLabel: string | null;
  stats: Loadable<ProfileStats>;
  posts: Loadable<ProfilePost[]>;
  /** Posts others tagged this member in. Leave out to hide the Tagged tab. */
  tagged?: Loadable<ProfilePost[]>;
  /** Check-ins. Null when the viewer isn't allowed to see attendance; they're left out. */
  activity: Loadable<ActivityItem[] | null>;
  /** Upcoming events with this member's RSVP, for the events he's going to. */
  upcoming: Loadable<EventSummary[]>;
  /** Shown under the avatar row, e.g. Edit profile. */
  actions?: ReactNode;
  /** Opens a post from the grid, the Text tab or Activity. */
  onOpenPost: (postId: string) => void;
  /** Opens an event from Activity. */
  onOpenEvent: (eventId: string) => void;
  /** Opens everyone from his line, from the "Initiated Spring 2019" under his name. */
  onOpenLine?: (term: string) => void;
  /** On your own empty profile, opens the composer. */
  onNewPost?: () => void;
  /** Gold ring around the photo on the member's own profile. */
  own?: boolean;
  onRefresh: () => void;
  refreshing?: boolean;
  /** The page's scroll view, e.g. so tapping the Profile tab again scrolls to the top. */
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
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

/** A small line icon beside a fact on the profile: a briefcase for work, a shop for businesses. */
function FactIcon({ kind }: { kind: 'work' | 'business' }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      {kind === 'work' ? (
        <>
          <Rect
            x={3}
            y={7}
            width={18}
            height={13}
            rx={2.5}
            stroke={colors.textSecondary}
            strokeWidth={1.8}
          />
          <Path
            d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"
            stroke={colors.textSecondary}
            strokeWidth={1.8}
          />
        </>
      ) : (
        <Path
          d="M4 10v9.5h16V10M3 10l1.5-5.5h15L21 10c0 1.4-1.1 2.5-2.5 2.5S16 11.4 16 10c0 1.4-1.1 2.5-2.5 2.5S11 11.4 11 10c0 1.4-1.1 2.5-2.5 2.5S6 11.4 6 10c0 1.4-1.1 2.5-2.5 2.5M10 19.5V15h4v4.5"
          stroke={colors.textSecondary}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
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
function PostGrid({ posts, onOpen }: { posts: ProfilePost[]; onOpen: (id: string) => void }) {
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
        <PostTile key={post.id} post={post} size={size} onOpen={onOpen} />
      ))}
    </View>
  );
}

const TEXT_POST_AVATAR = 40;

/**
 * Posts without photos, as a list you can read, like a feed of tweets: the member's photo,
 * their name and when, then the words.
 */
function TextPosts({
  posts,
  author,
  now,
  onOpen,
}: {
  posts: ProfilePost[];
  author: Pick<Profile, 'displayName' | 'photoURL'>;
  now: Date;
  onOpen: (id: string) => void;
}) {
  return (
    <View testID="profile-text-posts">
      {posts.map((post, i) => {
        const when = post.createdAt ? timeAgo(post.createdAt, now) : '';
        // Tagged posts show who posted them; the member's own show the member.
        const by = post.author ?? author;
        return (
          <Pressable
            key={post.id}
            onPress={() => onOpen(post.id)}
            style={({ pressed }) => [
              styles.textPost,
              i > 0 && styles.textPostDivider,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={[by.displayName, when, post.caption].filter(Boolean).join(', ')}
            accessibilityHint="Opens the post"
            testID={`profile-text-${post.id}`}
          >
            <Avatar name={by.displayName} uri={by.photoURL} size={TEXT_POST_AVATAR} />
            <View style={styles.textPostBody}>
              <View style={styles.textPostHead}>
                <AppText variant="subhead" weight="600" numberOfLines={1} style={styles.shrink}>
                  {by.displayName}
                </AppText>
                {when ? (
                  <AppText variant="subhead" color={colors.textSecondary}>
                    · {when}
                  </AppText>
                ) : null}
              </View>
              <AppText numberOfLines={8}>{post.caption}</AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two stacked squares in a tile's corner, Instagram's sign for a post with more photos. */
function MorePhotosIcon() {
  return (
    <View style={styles.more} testID="more-photos">
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
        <Rect x={7} y={3} width={14} height={14} rx={2.5} fill={palette.onInk} />
        <Path
          d="M4 7v12a1.5 1.5 0 0 0 1.5 1.5H17"
          stroke={palette.onInk}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

function PostTile({
  post,
  size,
  onOpen,
}: {
  post: ProfilePost;
  size: number;
  onOpen: (id: string) => void;
}) {
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

  const label =
    post.photoCount > 1
      ? `${post.caption || 'Photo post'}, ${post.photoCount} photos`
      : post.caption || 'Photo post';
  return (
    <Pressable
      onPress={() => onOpen(post.id)}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the post"
      testID={`profile-post-${post.id}`}
    >
      {post.coverPath && uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={motion.photoFade}
        />
      ) : null}
      {post.photoCount > 1 ? <MorePhotosIcon /> : null}
    </Pressable>
  );
}

function ChevronIcon() {
  return (
    <Svg width={8} height={13} viewBox="0 0 8 13" fill="none" accessibilityElementsHidden>
      <Path
        d="M1.5 1.5 6.5 6.5l-5 5"
        stroke={colors.textSecondary}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const ordinalYears = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`;

/** What a timeline row says: a title and a line under it. */
function describe(item: TimelineItem): { title: string; detail: string } {
  const join = (...parts: string[]) => parts.filter(Boolean).join(' · ');
  switch (item.kind) {
    case 'going':
      return { title: item.title, detail: join('Going', item.location) };
    case 'attended':
      return {
        title: item.title,
        detail: join(
          'Attended',
          item.location,
          item.serviceHours > 0 ? formatHours(item.serviceHours) : '',
        ),
      };
    case 'posted':
      return { title: 'Shared a post', detail: item.caption };
    case 'tagged':
      return { title: item.by ? `Tagged by ${item.by}` : 'Tagged in a post', detail: item.caption };
    case 'initiated':
      return item.years === 0
        ? { title: 'Initiated into Sigma Sigma Lambda', detail: '' }
        : { title: `Line anniversary: ${ordinalYears(item.years)}`, detail: '' };
  }
}

function TimelineRow({ item, onPress }: { item: TimelineItem; onPress?: () => void }) {
  const date = item.at;
  const { title, detail } = describe(item);
  const label = [title, detail, date ? date.toDateString() : ''].filter(Boolean).join(', ');
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.activityRow, pressed && onPress && styles.pressed]}
      testID={`activity-${item.key}`}
    >
      <View style={[styles.dateBlock, item.kind === 'going' && styles.dateBlockSoon]}>
        <AppText variant="caption" weight="700" color={colors.link}>
          {date ? MONTHS[date.getMonth()] : ''}
        </AppText>
        <AppText variant="headline" weight="700">
          {date ? String(date.getDate()) : ''}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="callout" weight="600" numberOfLines={2}>
          {title}
        </AppText>
        {detail ? (
          <AppText variant="footnote" color={colors.textSecondary} numberOfLines={2}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {onPress ? <ChevronIcon /> : null}
    </Pressable>
  );
}

/**
 * Everything a brother has been up to: events he's going to, then check-ins, posts, tags
 * and line anniversaries, newest first. Each row opens what it's about.
 */
function ActivityTimeline({
  own,
  initiationDate,
  now,
  activity,
  upcoming,
  posts,
  tagged,
  onOpenPost,
  onOpenEvent,
  onRetry,
}: {
  own: boolean;
  initiationDate: Date | null;
  now: Date;
  activity: Loadable<ActivityItem[] | null>;
  upcoming: Loadable<EventSummary[]>;
  posts: Loadable<ProfilePost[]>;
  tagged?: Loadable<ProfilePost[]>;
  onOpenPost: (postId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onRetry: () => void;
}) {
  const parts = [activity, upcoming, posts, ...(tagged ? [tagged] : [])];
  if (parts.some((p) => p.state === 'error')) {
    return <Message text="Couldn’t load activity." onRetry={onRetry} />;
  }
  if (activity.state !== 'ready' || upcoming.state !== 'ready' || posts.state !== 'ready') {
    return <Message text="Loading activity…" />;
  }
  const timeline = buildTimeline({
    attended: activity.data,
    posts: posts.data,
    tagged: tagged?.state === 'ready' ? tagged.data : [],
    upcoming: upcoming.data,
    initiationDate,
    now,
  });
  const open = (item: TimelineItem) => {
    if (item.kind === 'going' || item.kind === 'attended') return () => onOpenEvent(item.eventId);
    if (item.kind === 'posted' || item.kind === 'tagged') return () => onOpenPost(item.postId);
    return undefined;
  };
  const seesCheckIns = activity.data !== null;

  return (
    <View>
      {timeline.upcoming.length === 0 && timeline.recent.length === 0 ? (
        <Message
          text={own ? 'Your posts, RSVPs and check-ins will show up here.' : 'Nothing here yet.'}
        />
      ) : null}
      {timeline.upcoming.length > 0 ? (
        <View testID="activity-upcoming">
          <AppText
            variant="footnote"
            weight="600"
            color={colors.textSecondary}
            style={styles.sectionLabel}
          >
            COMING UP
          </AppText>
          {timeline.upcoming.map((item) => (
            <TimelineRow key={item.key} item={item} onPress={open(item)} />
          ))}
        </View>
      ) : null}
      {timeline.recent.length > 0 ? (
        <View testID="activity-recent">
          <AppText
            variant="footnote"
            weight="600"
            color={colors.textSecondary}
            style={styles.sectionLabel}
          >
            RECENT
          </AppText>
          {timeline.recent.map((item) => (
            <TimelineRow key={item.key} item={item} onPress={open(item)} />
          ))}
        </View>
      ) : null}
      {seesCheckIns ? (
        <AppText variant="caption" color={colors.textSecondary} style={styles.privacy}>
          {own
            ? 'Only you and chapter officers can see your check-ins.'
            : 'Only this brother and chapter officers can see his check-ins.'}
        </AppText>
      ) : null}
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
  tagged,
  activity,
  upcoming,
  actions,
  onOpenPost,
  onOpenEvent,
  onOpenLine,
  onNewPost,
  own = false,
  onRefresh,
  refreshing = false,
  scrollRef,
}: ProfileViewProps) {
  const [tab, setTab] = useState<Tab>('photos');
  const screenWidth = useWindowDimensions().width;
  const [now] = useState(() => new Date());
  const photoPosts = posts.state === 'ready' ? posts.data.filter((p) => p.coverPath) : [];
  const textPosts = posts.state === 'ready' ? posts.data.filter((p) => !p.coverPath) : [];
  const taggedPosts = tagged?.state === 'ready' ? tagged.data : [];
  // Photos and Activity are always there; Text and Tagged only when there are some.
  const segments = [
    { value: 'photos' as const, label: 'Photos' },
    ...(textPosts.length > 0 ? [{ value: 'text' as const, label: 'Text' }] : []),
    ...(taggedPosts.length > 0 ? [{ value: 'tagged' as const, label: 'Tagged' }] : []),
    { value: 'activity' as const, label: 'Activity' },
  ];
  const current: Tab = segments.some((s) => s.value === tab) ? tab : 'photos';
  const subtitle = profileSubtitle(profile);

  return (
    <ScrollView
      ref={scrollRef}
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
          onOpenLine && profile.initiationTerm.trim() ? (
            // "Initiated Spring 2019" opens his line; the headline before it stays plain.
            <AppText variant="subhead" color={colors.textSecondary}>
              {profile.headline.trim() ? `${profile.headline.trim()} · ` : ''}
              <AppText
                variant="subhead"
                color={colors.link}
                onPress={() => onOpenLine(profile.initiationTerm.trim())}
                accessibilityRole="link"
                accessibilityHint="Shows everyone from this line"
                testID="profile-line"
              >
                {`Initiated ${profile.initiationTerm.trim()}`}
              </AppText>
            </AppText>
          ) : (
            <AppText variant="subhead" color={colors.textSecondary}>
              {subtitle}
            </AppText>
          )
        ) : null}
        {profile.bio ? <AppText variant="subhead">{profile.bio}</AppText> : null}
        {profile.industry ? (
          <View style={styles.fact} testID="profile-industry">
            <FactIcon kind="work" />
            <AppText variant="subhead" style={styles.factText}>
              {industryLine(profile.industry)}
            </AppText>
          </View>
        ) : null}
        {profile.businesses.length > 0 ? (
          <View style={styles.fact} testID="profile-businesses">
            <FactIcon kind="business" />
            <AppText variant="subhead" style={styles.factText}>
              {businessLine(profile.businesses)}
            </AppText>
          </View>
        ) : null}
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

      {segments.length > 1 ? (
        <SegmentedControl
          segments={segments}
          value={current}
          onChange={setTab}
          accessibilityLabel="Profile sections"
          testID="profile-tabs"
        />
      ) : null}

      {current === 'photos' ? (
        posts.state === 'loading' ? (
          <GridSkeleton tileSize={gridTileSize(screenWidth)} />
        ) : posts.state === 'error' ? (
          <Message text="Couldn’t load posts." onRetry={onRefresh} />
        ) : posts.data.length === 0 ? (
          own && onNewPost ? (
            <View style={styles.empty} testID="profile-empty">
              <AppText variant="headline" align="center">
                Share your first post
              </AppText>
              <AppText variant="callout" color={colors.textSecondary} align="center">
                Photos and updates you share show up here for the chapter.
              </AppText>
              <Button title="Share a post" onPress={onNewPost} testID="profile-new-post" />
            </View>
          ) : (
            <Message text="No posts yet." />
          )
        ) : photoPosts.length === 0 ? (
          <Message text={own ? 'Your photo posts will show up here.' : 'No photos yet.'} />
        ) : (
          <PostGrid posts={photoPosts} onOpen={onOpenPost} />
        )
      ) : current === 'text' ? (
        <TextPosts posts={textPosts} author={profile} now={now} onOpen={onOpenPost} />
      ) : current === 'tagged' ? (
        <View style={styles.tagged} testID="profile-tagged">
          {taggedPosts.some((p) => p.coverPath) ? (
            <PostGrid posts={taggedPosts.filter((p) => p.coverPath)} onOpen={onOpenPost} />
          ) : null}
          <TextPosts
            posts={taggedPosts.filter((p) => !p.coverPath)}
            author={profile}
            now={now}
            onOpen={onOpenPost}
          />
        </View>
      ) : (
        <View testID="profile-activity">
          <ActivityTimeline
            own={own}
            initiationDate={profile.initiationDate}
            now={now}
            activity={activity}
            upcoming={upcoming}
            posts={posts}
            tagged={tagged}
            onOpenPost={onOpenPost}
            onOpenEvent={onOpenEvent}
            onRetry={onRefresh}
          />
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
  textPost: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  textPostBody: { flex: 1, gap: spacing.xxs },
  textPostHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  empty: { paddingTop: spacing.xl, gap: spacing.sm, alignItems: 'center' },
  tagged: { gap: spacing.md },
  textPostDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  more: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    shadowColor: palette.ink,
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0 },
  },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  factText: { flex: 1, paddingTop: 0 },
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
  dateBlockSoon: { backgroundColor: palette.goldSoft },
  sectionLabel: { paddingTop: spacing.lg, paddingBottom: spacing.xs },
  flex: { flex: 1, gap: spacing.xxs },
  message: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: spacing.sm },
  privacy: { paddingTop: spacing.md },
});
