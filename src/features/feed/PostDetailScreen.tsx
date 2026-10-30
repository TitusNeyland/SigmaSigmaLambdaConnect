import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addComment, subscribeToComments, type PostComment } from '@/data/comments';
import { restrictionNote, useRestriction } from '@/features/moderation/useRestriction';
import { fetchPost, type FeedPost } from '@/data/feed';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, MIN_TOUCH, radius, spacing, type } from '@/theme';
import { AppText, Button, NavHeader } from '@/ui';

import { canPostComment, MAX_COMMENT, threadComments } from './commentLogic';
import { CommentItem } from './CommentRow';
import { notifyFeedChanged } from './feedEvents';
import { PostCard } from './PostCard';
import { ReportedNotice } from './ReportedNotice';
import { useHiddenContent } from './useHidden';

type Loaded = { state: 'loading' } | { state: 'ready'; post: FeedPost | null } | { state: 'error' };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

/** A post with its comments, and a box to add one. */
export function PostDetailScreen({ id }: { id: string }) {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [commentsFailed, setCommentsFailed] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!uid) return;
    let live = true;
    fetchPost(id, uid).then(
      (post) => live && setLoaded({ state: 'ready', post }),
      () => live && setLoaded({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [id, uid, attempt]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToComments(
      id,
      uid,
      (list) => {
        setComments(list);
        setCommentsFailed(false);
      },
      () => setCommentsFailed(true),
    );
  }, [id, uid]);

  const { blocked, hidden } = useHiddenContent(uid);
  const pausedUntil = useRestriction(uid);
  const rows = useMemo(
    () => threadComments(comments ?? [], blocked, hidden, id),
    [comments, blocked, hidden, id],
  );
  const loadedPost = loaded.state === 'ready' ? loaded.post : null;
  // A post the member reported, or whose author they blocked, isn't shown even by link.
  const post =
    loadedPost && !hidden.has(`post_${id}`) && !blocked.has(loadedPost.authorId)
      ? loadedPost
      : null;
  // The count shown follows the live list, so it updates the moment a comment lands.
  const count = comments ? comments.length : (post?.commentCount ?? 0);

  async function send() {
    if (!canPostComment(draft) || sending) return;
    setSending(true);
    setSendFailed(false);
    try {
      await addComment(id, uid, draft, replyTo?.id ?? null);
      setDraft('');
      setReplyTo(null);
    } catch {
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  }

  if (loaded.state !== 'ready' || !post) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <NavHeader title="Post" onBack={goBack} backTestID="post-back" />
        <View style={styles.center}>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            {loaded.state === 'loading'
              ? 'Loading…'
              : loaded.state === 'error'
                ? 'Couldn’t load this post.'
                : loadedPost
                  ? 'You won’t see this post. You reported it or blocked its author.'
                  : 'This post isn’t available. It may have been deleted.'}
          </AppText>
          {loaded.state === 'error' ? (
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                setLoaded({ state: 'loading' });
                setAttempt((n) => n + 1);
              }}
              testID="post-retry"
            />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <NavHeader title="Post" onBack={goBack} backTestID="post-back" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={rows}
          keyExtractor={(r) => r.comment.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <PostCard
                post={{ ...post, commentCount: 0 }}
                now={now}
                me={uid}
                hideCommentLink
                onEdited={(e) =>
                  setLoaded((l) =>
                    l.state === 'ready' && l.post ? { ...l, post: { ...l.post, ...e } } : l,
                  )
                }
                onDeleted={() => {
                  notifyFeedChanged();
                  goBack();
                }}
              />
              <View style={styles.commentsHead}>
                <AppText variant="headline" testID="comment-count">
                  {count === 1 ? '1 comment' : `${count} comments`}
                </AppText>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <CommentItem
              postId={id}
              comment={item.comment}
              isReply={item.isReply}
              me={uid}
              now={now}
              canReply={post.allowComments}
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
              {commentsFailed
                ? 'Couldn’t load comments.'
                : comments === null
                  ? 'Loading comments…'
                  : post.allowComments
                    ? 'No comments yet. Start the conversation.'
                    : 'Comments are off for this post.'}
            </AppText>
          }
        />

        {post.allowComments && pausedUntil ? (
          <View style={styles.inputBar}>
            <AppText variant="footnote" color={colors.warning} testID="comments-paused">
              {restrictionNote(pausedUntil)}
            </AppText>
          </View>
        ) : post.allowComments ? (
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
                disabled={!canPostComment(draft) || sending}
                accessibilityRole="button"
                accessibilityLabel="Post comment"
                accessibilityState={{ disabled: !canPostComment(draft) || sending }}
                style={styles.send}
                testID="comment-post"
              >
                <AppText
                  variant="subhead"
                  weight="600"
                  color={canPostComment(draft) && !sending ? colors.link : colors.textSecondary}
                >
                  {sending ? 'Posting…' : 'Post'}
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <ReportedNotice />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  commentsHead: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  empty: { padding: spacing.xl },
  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  replying: { flexDirection: 'row', alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    ...type.callout,
    color: colors.text,
    minHeight: MIN_TOUCH - spacing.xs,
    maxHeight: MIN_TOUCH * 3,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.fill,
  },
  send: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
