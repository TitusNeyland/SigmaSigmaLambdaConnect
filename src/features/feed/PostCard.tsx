import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { FeedPost } from '@/data/feed';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { AppText, Avatar } from '@/ui';

import { authorLine, captionPreview, commentsLabel, likesLabel, timeAgo } from './feedLogic';
import { PhotoCarousel } from './PhotoCarousel';
import { useLike } from './useLike';

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.4 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.6 0 5.5 3.7 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
        fill={filled ? colors.text : 'none'}
        stroke={colors.text}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CommentIcon() {
  return (
    <Svg width={25} height={25} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20l1.2-4.1A8.5 8.5 0 1 1 20.5 11.5z"
        stroke={colors.text}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export type PostCardProps = {
  post: FeedPost;
  now: Date;
  /** The signed-in member, so their own name opens their Profile tab. */
  me: string;
};

function openAuthor(post: FeedPost, me: string) {
  if (post.authorId === me) router.push('/profile');
  else router.push({ pathname: '/chapter/member/[uid]', params: { uid: post.authorId } });
}

function openPost(id: string) {
  router.push({ pathname: '/home/post/[id]', params: { id } });
}

/** One post in the feed: author line, photos, counts and caption, Instagram style. */
export function PostCard({ post, now, me }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const name = post.author?.displayName ?? 'Former member';
  const line = post.author ? authorLine(post.author) : '';
  const caption = captionPreview(post.caption);
  const like = useLike(post.id, me, { liked: post.likedByMe, count: post.likeCount });

  return (
    <View style={styles.card} testID={`post-${post.id}`}>
      <Pressable
        onPress={post.author ? () => openAuthor(post, me) : undefined}
        disabled={!post.author}
        accessibilityRole={post.author ? 'button' : undefined}
        accessibilityLabel={[name, line, timeAgo(post.createdAt, now)].filter(Boolean).join(', ')}
        style={styles.header}
        testID={`post-author-${post.id}`}
      >
        <Avatar name={name} uri={post.author?.photoURL} size={36} />
        <View style={styles.flex}>
          <AppText variant="subhead" weight="600" numberOfLines={1}>
            {name}
          </AppText>
          {line ? (
            <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
              {line}
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" color={colors.textSecondary}>
          {timeAgo(post.createdAt, now)}
        </AppText>
      </Pressable>

      <PhotoCarousel paths={post.photoPaths} label={`Photo from ${name}`} onDoubleTap={like.like} />

      <View style={styles.actions}>
        <Pressable
          onPress={like.toggle}
          accessibilityRole="button"
          accessibilityLabel={like.liked ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: like.liked }}
          style={styles.action}
          testID={`like-${post.id}`}
        >
          <HeartIcon filled={like.liked} />
        </Pressable>
        {post.allowComments ? (
          <Pressable
            onPress={() => openPost(post.id)}
            accessibilityRole="button"
            accessibilityLabel="Comment"
            style={styles.action}
            testID={`comment-${post.id}`}
          >
            <CommentIcon />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        {like.count > 0 ? (
          <AppText variant="subhead" weight="600" testID={`likes-${post.id}`}>
            {likesLabel(like.count)}
          </AppText>
        ) : null}
        {like.failed ? (
          <AppText variant="footnote" color={colors.destructive} testID={`like-error-${post.id}`}>
            Couldn’t save your like. Try again.
          </AppText>
        ) : null}
        {caption.text ? (
          <AppText variant="subhead" testID={`caption-${post.id}`}>
            <AppText variant="subhead" weight="600">
              {name}{' '}
            </AppText>
            {expanded ? post.caption.trim() : caption.text}
            {caption.truncated && !expanded ? (
              <AppText
                variant="subhead"
                color={colors.textSecondary}
                onPress={() => setExpanded(true)}
                accessibilityRole="button"
                testID={`more-${post.id}`}
              >
                {' '}
                more
              </AppText>
            ) : null}
          </AppText>
        ) : null}
        {post.allowComments && post.commentCount > 0 ? (
          <Pressable
            onPress={() => openPost(post.id)}
            accessibilityRole="button"
            style={styles.commentsLink}
            testID={`comments-${post.id}`}
          >
            <AppText variant="subhead" color={colors.textSecondary}>
              {commentsLabel(post.commentCount)}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, paddingBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  action: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  commentsLink: { minHeight: MIN_TOUCH - spacing.md, justifyContent: 'center' },
});
