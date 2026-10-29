import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FeedPost } from '@/data/feed';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { AppText, Avatar } from '@/ui';

import { authorLine, captionPreview, commentsLabel, likesLabel, timeAgo } from './feedLogic';
import { PhotoCarousel } from './PhotoCarousel';

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

      <PhotoCarousel paths={post.photoPaths} label={`Photo from ${name}`} />

      <View style={styles.body}>
        {post.likeCount > 0 ? (
          <AppText variant="subhead" weight="600" testID={`likes-${post.id}`}>
            {likesLabel(post.likeCount)}
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
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  commentsLink: { minHeight: MIN_TOUCH - spacing.md, justifyContent: 'center' },
});
