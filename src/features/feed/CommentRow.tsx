import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { deleteComment, type PostComment } from '@/data/comments';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { AppText, Avatar, BottomSheet, Button } from '@/ui';

import { likesLabel, timeAgo } from './feedLogic';
import { useCommentLike } from './useLike';

function SmallHeart({ filled }: { filled: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.4 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.6 0 5.5 3.7 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
        fill={filled ? colors.text : 'none'}
        stroke={filled ? colors.text : colors.textSecondary}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export type CommentRowProps = {
  postId: string;
  comment: PostComment;
  isReply: boolean;
  me: string;
  now: Date;
  canReply: boolean;
  onReply: (comment: PostComment) => void;
};

/** One comment: author and text, then time, likes and Reply, with a heart on the right. */
export function CommentItem({
  postId,
  comment,
  isReply,
  me,
  now,
  canReply,
  onReply,
}: CommentRowProps) {
  const like = useCommentLike(postId, comment.id, me, {
    liked: comment.likedByMe,
    count: comment.likeCount,
  });
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  async function remove() {
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await deleteComment(postId, comment.id);
      setConfirm(false);
    } catch {
      setDeleteFailed(true);
    } finally {
      setDeleting(false);
    }
  }

  const name = comment.authorId === me ? 'You' : (comment.author?.displayName ?? 'Former member');

  return (
    <View style={[styles.row, isReply && styles.reply]} testID={`comment-${comment.id}`}>
      <Avatar
        name={comment.author?.displayName ?? name}
        uri={comment.author?.photoURL}
        size={isReply ? 26 : 32}
      />
      <View style={styles.flex}>
        <AppText variant="subhead" testID={`comment-text-${comment.id}`}>
          <AppText variant="subhead" weight="600">
            {name}{' '}
          </AppText>
          {comment.text}
        </AppText>
        <View style={styles.meta}>
          <AppText variant="caption" color={colors.textSecondary}>
            {timeAgo(comment.createdAt, now)}
          </AppText>
          {like.count > 0 ? (
            <AppText
              variant="caption"
              weight="600"
              color={colors.textSecondary}
              testID={`comment-likes-${comment.id}`}
            >
              {likesLabel(like.count)}
            </AppText>
          ) : null}
          {comment.authorId === me ? (
            <Pressable
              onPress={() => {
                setDeleteFailed(false);
                setConfirm(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Delete comment"
              hitSlop={spacing.md}
              testID={`comment-delete-${comment.id}`}
            >
              <AppText variant="caption" weight="600" color={colors.textSecondary}>
                Delete
              </AppText>
            </Pressable>
          ) : null}
          {canReply ? (
            <Pressable
              onPress={() => onReply(comment)}
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${comment.author?.displayName ?? 'comment'}`}
              hitSlop={spacing.md}
              testID={`reply-${comment.id}`}
            >
              <AppText variant="caption" weight="600" color={colors.textSecondary}>
                Reply
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={like.toggle}
        accessibilityRole="button"
        accessibilityLabel={like.liked ? 'Unlike comment' : 'Like comment'}
        accessibilityState={{ selected: like.liked }}
        style={styles.heart}
        testID={`comment-like-${comment.id}`}
      >
        <SmallHeart filled={like.liked} />
      </Pressable>

      <BottomSheet
        visible={confirm}
        onClose={() => !deleting && setConfirm(false)}
        title="Delete this comment?"
      >
        {deleteFailed ? (
          <AppText variant="footnote" color={colors.destructive} align="center">
            Couldn’t delete it. Try again.
          </AppText>
        ) : null}
        <Button
          title="Delete"
          variant="destructive"
          onPress={remove}
          loading={deleting}
          fullWidth
          testID="comment-delete-confirm"
        />
        <Button
          title="Cancel"
          variant="plain"
          onPress={() => setConfirm(false)}
          disabled={deleting}
          fullWidth
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.sm,
  },
  reply: { paddingLeft: spacing.lg + spacing.xxl + spacing.sm },
  flex: { flex: 1, gap: spacing.xxs },
  meta: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  heart: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
