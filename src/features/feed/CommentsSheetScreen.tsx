import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchPost, type FeedPost } from '@/data/feed';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, spacing } from '@/theme';
import { AppText, Button } from '@/ui';

import { CommentsPanel } from './CommentsPanel';
import { ReportedNotice } from './ReportedNotice';
import { useHiddenContent } from './useHidden';

type Loaded = { state: 'loading' } | { state: 'ready'; post: FeedPost | null } | { state: 'error' };

/**
 * A post's comments in a sheet over the feed, Instagram style. The route presents it as a
 * native sheet that rests at about 60% and drags up to full height.
 */
export function CommentsSheetScreen({ id }: { id: string }) {
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
  // Same as the post screen: a reported post or a blocked author's post stays hidden.
  const post =
    loadedPost && !hidden.has(`post_${id}`) && !blocked.has(loadedPost.authorId)
      ? loadedPost
      : null;

  return (
    // No bottom safe-area edge: CommentsPanel keeps clear of the home indicator and keyboard.
    <SafeAreaView style={styles.safe} edges={[]} testID="comments-sheet">
      <View style={styles.header}>
        <AppText variant="headline" align="center" accessibilityRole="header">
          Comments
        </AppText>
      </View>
      {post ? (
        <CommentsPanel
          postId={id}
          me={uid}
          allowComments={post.allowComments}
          initialCount={post.commentCount}
          now={now}
        />
      ) : (
        <View style={styles.center}>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            {loaded.state === 'loading'
              ? 'Loading…'
              : loaded.state === 'error'
                ? 'Couldn’t load comments.'
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
              testID="comments-retry"
            />
          ) : null}
        </View>
      )}
      <ReportedNotice />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
});
