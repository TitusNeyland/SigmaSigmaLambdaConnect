import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { addComment, subscribeToComments, type PostComment } from '@/data/comments';
import { restrictionNote, useRestriction } from '@/features/moderation/useRestriction';
import { colors, MIN_TOUCH, spacing, type } from '@/theme';
import { useProfile } from '@/features/profile/useProfileData';
import { AppText, Avatar, useKeyboardInset } from '@/ui';

import { canPostComment, MAX_COMMENT, previewOf, threadComments } from './commentLogic';
import { notifyCommentsChanged } from './feedEvents';
import { CommentItem } from './CommentRow';
import { useHiddenContent } from './useHidden';

const AVATAR = 36;

export type CommentsPanelProps = {
  postId: string;
  me: string;
  allowComments: boolean;
  /** Shown until the live list loads. */
  initialCount: number;
  now: Date;
  /** Above the comments, scrolling with them. Gets the live comment count. */
  renderHeader?: (count: number) => ReactElement;
};

/**
 * A post's comments with replies threaded, and the box to add one. Used by the comments
 * sheet on the feed and by the full post screen.
 */
export function CommentsPanel({
  postId,
  me,
  allowComments,
  initialCount,
  now,
  renderHeader,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  // Keeps the comment bar clear of the home indicator, and on top of the keyboard when it's
  // open, in a sheet or on a full screen.
  const keyboardPadding = useKeyboardInset();
  // The member's own avatar beside the comment box, like Instagram.
  const profile = useProfile(me, { own: true });
  const myProfile = profile.state === 'ready' ? profile.data : null;

  useEffect(() => {
    if (!me) return;
    return subscribeToComments(
      postId,
      me,
      (list) => {
        setComments(list);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [postId, me]);

  // The feed under the sheet follows along: the count and newest comments update as
  // comments are added or deleted. The count is every comment, like the server's.
  useEffect(() => {
    if (!comments) return;
    notifyCommentsChanged(postId, {
      commentCount: comments.length,
      previewComments: previewOf(comments),
    });
  }, [comments, postId]);

  const { blocked, hidden } = useHiddenContent(me);
  const pausedUntil = useRestriction(me);
  const rows = useMemo(
    () => threadComments(comments ?? [], blocked, hidden, postId),
    [comments, blocked, hidden, postId],
  );
  // The count follows the live list, so it updates the moment a comment lands.
  const count = comments ? comments.length : initialCount;

  async function send() {
    if (!canPostComment(draft) || sending) return;
    setSending(true);
    setSendFailed(false);
    try {
      await addComment(postId, me, draft, replyTo?.id ?? null);
      setDraft('');
      setReplyTo(null);
    } catch {
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  }

  const ready = canPostComment(draft) && !sending;

  return (
    <View style={[styles.flex, { paddingBottom: keyboardPadding }]} testID="comments-panel">
      <FlatList
        data={rows}
        keyExtractor={(r) => r.comment.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={renderHeader ? renderHeader(count) : undefined}
        renderItem={({ item }) => (
          <CommentItem
            postId={postId}
            comment={item.comment}
            isReply={item.isReply}
            me={me}
            now={now}
            canReply={allowComments}
            onReply={(c) => setReplyTo(c)}
          />
        )}
        ListEmptyComponent={
          <AppText
            variant="callout"
            color={colors.textSecondary}
            align="center"
            style={styles.empty}
          >
            {failed
              ? 'Couldn’t load comments.'
              : comments === null
                ? 'Loading comments…'
                : allowComments
                  ? 'No comments yet. Start the conversation.'
                  : 'Comments are off for this post.'}
          </AppText>
        }
      />

      {allowComments && pausedUntil ? (
        <View style={styles.inputBar}>
          <AppText variant="footnote" color={colors.warning} testID="comments-paused">
            {restrictionNote(pausedUntil)}
          </AppText>
        </View>
      ) : allowComments ? (
        <View style={styles.inputBar}>
          {replyTo ? (
            <View style={styles.replying} testID="replying-to">
              <AppText variant="caption" color={colors.textSecondary} style={styles.flex}>
                Replying to {replyTo.author?.displayName ?? 'a comment'}
              </AppText>
              <Pressable
                onPress={() => setReplyTo(null)}
                accessibilityRole="button"
                hitSlop={spacing.md}
                testID="reply-cancel"
              >
                <AppText variant="caption" weight="600" color={colors.textSecondary}>
                  Cancel
                </AppText>
              </Pressable>
            </View>
          ) : null}
          {sendFailed ? (
            <AppText variant="caption" color={colors.destructive} testID="comment-error">
              Couldn’t post your comment. Try again.
            </AppText>
          ) : null}
          <View style={styles.inputRow}>
            {myProfile ? (
              <Avatar
                name={myProfile.displayName}
                uri={myProfile.photoURL}
                size={AVATAR}
                testID="comment-avatar"
              />
            ) : null}
            {/* A rounded pill with Post inside it, like Instagram's comment box. */}
            <View style={styles.pill}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel={replyTo ? 'Reply' : 'Comment'}
                multiline
                maxLength={MAX_COMMENT}
                style={styles.input}
                testID="comment-input"
              />
              <Pressable
                onPress={send}
                disabled={!ready}
                accessibilityRole="button"
                accessibilityLabel="Post comment"
                accessibilityState={{ disabled: !ready }}
                style={styles.send}
                testID="comment-post"
              >
                <AppText
                  variant="subhead"
                  weight="600"
                  color={ready ? colors.link : colors.textSecondary}
                >
                  {sending ? 'Posting…' : 'Post'}
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { padding: spacing.xl },
  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  replying: { flexDirection: 'row', alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: MIN_TOUCH,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: MIN_TOUCH / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    ...type.callout,
    color: colors.text,
    maxHeight: MIN_TOUCH * 3,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  send: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
