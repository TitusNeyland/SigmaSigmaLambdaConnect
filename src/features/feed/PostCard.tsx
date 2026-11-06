import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { FeedPost } from '@/data/feed';
import type { PostEdit } from '@/data/posts';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { CHAPTER_NAME } from '@/config/app';
import { AppText, Avatar, Monogram, VerifiedBadge } from '@/ui';

import {
  authorLine,
  captionPreview,
  commentsCountLabel,
  commentsLabel,
  likesLabel,
  taggedParts,
  timeAgo,
} from './feedLogic';
import { OfficialEventCard } from './OfficialEventCard';
import { PhotoCarousel } from './PhotoCarousel';
import { PostMenu } from './PostMenu';
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
  /** On the post's own screen, the comment button and link have nowhere new to go. */
  hideCommentLink?: boolean;
  /** Called after the author deletes it, so the list can drop it. */
  onDeleted?: (id: string) => void;
  /** Called after the author edits it. */
  onEdited?: (edit: PostEdit) => void;
};

function openAuthor(post: FeedPost, me: string) {
  if (post.authorId === me) router.push('/profile');
  else router.push({ pathname: '/chapter/member/[uid]', params: { uid: post.authorId } });
}

function openMember(uid: string, me: string) {
  if (uid === me) router.push('/profile');
  else router.push({ pathname: '/chapter/member/[uid]', params: { uid } });
}

/**
 * "with Chris and Zed" under a post: who's tagged in it, each name opening their profile.
 * Past two names (and a third), the rest read as "and N others".
 */
function TaggedLine({ post, me }: { post: FeedPost; me: string }) {
  if (post.tagged.length === 0) return null;
  const { shown, others } = taggedParts(post.tagged);
  const pieces = [
    ...shown.map((p) => ({ key: p.uid, text: p.displayName, uid: p.uid })),
    ...(others > 0
      ? [{ key: 'others', text: `${others} ${others === 1 ? 'other' : 'others'}`, uid: '' }]
      : []),
  ];
  return (
    <View style={styles.tagged} testID={`tagged-${post.id}`}>
      <PersonIcon />
      <AppText variant="subhead" color={colors.textSecondary} style={styles.flex}>
        with{' '}
        {pieces.map((piece, i) => (
          <AppText key={piece.key} variant="subhead">
            {i === 0 ? '' : i === pieces.length - 1 ? ' and ' : ', '}
            <AppText
              variant="subhead"
              weight="600"
              color={colors.text}
              onPress={piece.uid ? () => openMember(piece.uid, me) : undefined}
              accessibilityRole={piece.uid ? 'link' : undefined}
              testID={piece.uid ? `tagged-${post.id}-${piece.uid}` : undefined}
            >
              {piece.text}
            </AppText>
          </AppText>
        ))}
      </AppText>
    </View>
  );
}

function PersonIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Circle cx={12} cy={8} r={4} stroke={colors.textSecondary} strokeWidth={1.8} />
      <Path
        d="M4.5 20.5a7.5 7.5 0 0 1 15 0"
        stroke={colors.textSecondary}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Comments open in a sheet over the feed. */
function openComments(id: string) {
  router.push({ pathname: '/home/comments/[id]', params: { id } });
}

const AVATAR = 36;

/**
 * One post in the feed. Photo posts read Instagram style: author line, photos, counts,
 * then "Name caption". Text-only posts read like a tweet: the text sits right under the
 * author line, lined up with the name, and the actions follow it.
 */
export function PostCard({
  post: original,
  now,
  me,
  hideCommentLink = false,
  onDeleted,
  onEdited,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [edit, setEdit] = useState<PostEdit | null>(null);
  const post = edit ? { ...original, ...edit } : original;
  // Official posts speak as the chapter (#39); everyone else as themselves.
  const name = post.official ? CHAPTER_NAME : (post.author?.displayName ?? 'Former member');
  const line = post.official ? 'Official chapter post' : post.author ? authorLine(post.author) : '';
  const tappable = !post.official && !!post.author;
  const caption = captionPreview(post.caption);
  const like = useLike(post.id, me, { liked: post.likedByMe, count: post.likeCount });
  const textOnly = post.photoPaths.length === 0;

  const more =
    caption.truncated && !expanded ? (
      <AppText
        variant={textOnly ? 'body' : 'subhead'}
        color={colors.textSecondary}
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        testID={`more-${post.id}`}
      >
        {' '}
        more
      </AppText>
    ) : null;
  const shownCaption = expanded ? post.caption.trim() : caption.text;

  return (
    <View style={styles.card} testID={`post-${post.id}`}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={tappable ? () => openAuthor(post, me) : undefined}
          disabled={!tappable}
          accessibilityRole={tappable ? 'button' : undefined}
          accessibilityLabel={[
            name,
            post.official ? 'verified' : '',
            line,
            timeAgo(post.createdAt, now),
          ]
            .filter(Boolean)
            .join(', ')}
          style={styles.header}
          testID={`post-author-${post.id}`}
        >
          {post.official ? (
            <Monogram size={AVATAR} />
          ) : (
            <Avatar name={name} uri={post.author?.photoURL} size={AVATAR} />
          )}
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <AppText variant="subhead" weight="600" numberOfLines={1} style={styles.shrink}>
                {name}
              </AppText>
              {post.official ? <VerifiedBadge /> : null}
            </View>
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
        <PostMenu
          post={post}
          me={me}
          onEdited={(e) => {
            setEdit(e);
            onEdited?.(e);
          }}
          onDeleted={() => onDeleted?.(post.id)}
        />
      </View>

      {textOnly ? (
        caption.text ? (
          <AppText style={styles.textPost} testID={`caption-${post.id}`}>
            {shownCaption}
            {more}
          </AppText>
        ) : null
      ) : (
        <PhotoCarousel
          paths={post.photoPaths}
          aspectRatio={post.aspectRatio}
          label={`Photo from ${name}`}
          onDoubleTap={like.like}
        />
      )}

      {/* Actions and comments line up down the feed, with or without photos. */}
      <View style={styles.actions} testID={`actions-${post.id}`}>
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
        {post.allowComments && !hideCommentLink ? (
          <Pressable
            onPress={() => openComments(post.id)}
            accessibilityRole="button"
            accessibilityLabel={
              post.commentCount > 0
                ? `Comment, ${commentsCountLabel(post.commentCount)}`
                : 'Comment'
            }
            style={[styles.action, post.commentCount > 0 && styles.actionWithCount]}
            testID={`comment-${post.id}`}
          >
            <CommentIcon />
            {post.commentCount > 0 ? (
              <AppText variant="subhead" weight="600" testID={`comment-count-${post.id}`}>
                {post.commentCount}
              </AppText>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body} testID={`post-body-${post.id}`}>
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
        <TaggedLine post={post} me={me} />
        {!textOnly && caption.text ? (
          <AppText variant="subhead" testID={`caption-${post.id}`}>
            <AppText variant="subhead" weight="600">
              {name}{' '}
            </AppText>
            {shownCaption}
            {more}
          </AppText>
        ) : null}
        {post.allowComments && post.commentCount > 0 ? (
          <Pressable
            onPress={() => openComments(post.id)}
            accessibilityRole="button"
            style={styles.commentsLink}
            testID={`comments-${post.id}`}
          >
            <AppText variant="subhead" color={colors.textSecondary}>
              {commentsLabel(post.commentCount)}
            </AppText>
          </Pressable>
        ) : null}
        {/* The newest couple of comments, Instagram style. The post screen lists them all. */}
        {post.allowComments && !hideCommentLink
          ? post.previewComments.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => openComments(post.id)}
                accessibilityRole="button"
                accessibilityHint="Opens the comments"
                testID={`preview-comment-${c.id}`}
              >
                <AppText variant="subhead" numberOfLines={2}>
                  <AppText variant="subhead" weight="600">
                    {c.authorName}{' '}
                  </AppText>
                  {c.text}
                </AppText>
              </Pressable>
            ))
          : null}
      </View>
      {post.official && post.eventId ? (
        <OfficialEventCard eventId={post.eventId} me={me} now={now} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, paddingBottom: spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  shrink: { flexShrink: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.lg },
  header: {
    flex: 1,
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
  // The comment button grows to fit its count beside the icon.
  actionWithCount: {
    width: undefined,
    minWidth: MIN_TOUCH,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  body: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  commentsLink: { minHeight: MIN_TOUCH - spacing.md, justifyContent: 'center' },
  tagged: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // A text-only post's text starts at the left edge, in line with the avatar and actions.
  textPost: { paddingHorizontal: spacing.lg },
});
