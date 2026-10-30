import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchUpcomingEvents, type EventSummary } from '@/data/events';
import { fetchFeedPage, type FeedCursor, type FeedPost } from '@/data/feed';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, spacing } from '@/theme';
import { AppText, Button } from '@/ui';

import { EventsStrip } from './EventsStrip';
import { onFeedChanged } from './feedEvents';
import { appendPage, visiblePosts } from './feedLogic';
import { PostCard } from './PostCard';
import { ReportedNotice } from './ReportedNotice';
import { useHiddenContent } from './useHidden';

type Feed =
  | { state: 'loading' }
  | { state: 'error' }
  | {
      state: 'ready';
      posts: FeedPost[];
      cursor: FeedCursor;
      loadingMore: boolean;
      moreFailed: boolean;
    };

/** Home: upcoming events, then the chapter's posts, newest first. */
export function FeedScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const { blocked, hidden } = useHiddenContent(uid);
  const [feed, setFeed] = useState<Feed>({ state: 'loading' });
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const loadId = useRef(0);

  const loadFirst = useCallback(() => {
    if (!uid) return;
    const id = ++loadId.current;
    const at = new Date();
    fetchFeedPage(uid).then(
      (page) => {
        if (id !== loadId.current) return;
        setNow(at);
        setFeed({
          state: 'ready',
          posts: page.posts,
          cursor: page.cursor,
          loadingMore: false,
          moreFailed: false,
        });
        setRefreshing(false);
      },
      () => {
        if (id !== loadId.current) return;
        setFeed((f) => (f.state === 'ready' ? f : { state: 'error' }));
        setRefreshing(false);
      },
    );
    // The strip is a bonus; the feed still shows if it fails.
    fetchUpcomingEvents(uid, at).then(setEvents, () => {});
  }, [uid]);

  // Sharing a post reloads the feed so it shows at the top.
  useEffect(() => onFeedChanged(loadFirst), [loadFirst]);

  // Load the first time Home is shown; after that, pull to refresh.
  const loadedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (loadedOnce.current) return;
      loadedOnce.current = true;
      loadFirst();
    }, [loadFirst]),
  );

  function loadMore() {
    if (feed.state !== 'ready' || !feed.cursor || feed.loadingMore) return;
    const id = loadId.current;
    setFeed({ ...feed, loadingMore: true, moreFailed: false });
    fetchFeedPage(uid, feed.cursor).then(
      (page) =>
        id === loadId.current &&
        setFeed((f) =>
          f.state === 'ready'
            ? {
                ...f,
                posts: appendPage(f.posts, page.posts),
                cursor: page.cursor,
                loadingMore: false,
              }
            : f,
        ),
      () =>
        id === loadId.current &&
        setFeed((f) => (f.state === 'ready' ? { ...f, loadingMore: false, moreFailed: true } : f)),
    );
  }

  function removePost(id: string) {
    setFeed((f) => (f.state === 'ready' ? { ...f, posts: f.posts.filter((p) => p.id !== id) } : f));
  }

  const posts = useMemo(
    () => (feed.state === 'ready' ? visiblePosts(feed.posts, blocked, hidden) : []),
    [feed, blocked, hidden],
  );

  const header = (
    <View>
      <View style={styles.title}>
        <AppText variant="title2" accessibilityRole="header">
          Sigma Sigma Lambda
        </AppText>
      </View>
      <EventsStrip events={events} now={now} />
      <View style={styles.divider} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard post={item} now={now} me={uid} onDeleted={removePost} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          feed.state === 'loading' ? (
            <AppText
              variant="callout"
              color={colors.textSecondary}
              align="center"
              style={styles.message}
            >
              Loading…
            </AppText>
          ) : feed.state === 'error' ? (
            <View style={styles.message}>
              <AppText variant="callout" color={colors.textSecondary} align="center">
                Couldn’t load the feed.
              </AppText>
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => {
                  setFeed({ state: 'loading' });
                  loadFirst();
                }}
                testID="feed-retry"
              />
            </View>
          ) : (
            <View style={styles.message} testID="feed-empty">
              <AppText variant="headline" align="center">
                No posts yet
              </AppText>
              <AppText variant="callout" color={colors.textSecondary} align="center">
                Photos from chapter events and brotherhood will show up here.
              </AppText>
            </View>
          )
        }
        ListFooterComponent={
          feed.state === 'ready' && feed.moreFailed ? (
            <View style={styles.message}>
              <Button title="Load more" variant="secondary" onPress={loadMore} testID="feed-more" />
            </View>
          ) : feed.state === 'ready' && feed.loadingMore ? (
            <AppText
              variant="footnote"
              color={colors.textSecondary}
              align="center"
              style={styles.footer}
            >
              Loading more…
            </AppText>
          ) : undefined
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadFirst();
        }}
        testID="feed"
      />
      <ReportedNotice />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  separator: { height: spacing.sm },
  message: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  footer: { paddingVertical: spacing.lg },
});
