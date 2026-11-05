import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchPost, type FeedPost } from '@/data/feed';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, spacing } from '@/theme';
import { AppText, Button, NavHeader } from '@/ui';

import { CommentsPanel } from './CommentsPanel';
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

  const { blocked, hidden } = useHiddenContent(uid);
  const loadedPost = loaded.state === 'ready' ? loaded.post : null;
  // A post the member reported, or whose author they blocked, isn't shown even by link.
  const post =
    loadedPost && !hidden.has(`post_${id}`) && !blocked.has(loadedPost.authorId)
      ? loadedPost
      : null;
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
    // No bottom safe-area edge: CommentsPanel keeps clear of the home indicator and keyboard.
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader title="Post" onBack={goBack} backTestID="post-back" />
      <CommentsPanel
        postId={id}
        me={uid}
        allowComments={post.allowComments}
        initialCount={post.commentCount}
        now={now}
        renderHeader={(count) => (
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
        )}
      />
      <ReportedNotice />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
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
});
