import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchActivity,
  fetchActivitySeen,
  markActivitySeen,
  type ActivityItem,
} from '@/data/activity';
import { useAuth } from '@/features/auth/AuthProvider';
import { timeAgo } from '@/features/feed/feedLogic';
import { useHiddenContent } from '@/features/feed/useHidden';
import { useStorageUrl } from '@/features/feed/useStorageUrl';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';
import { AppText, Avatar, Button, NavHeader } from '@/ui';

import { activityAction, activitySections, actorNames, type ActivityRow } from './activityLogic';

const AVATAR = 44;
const THUMB = 44;

type Loaded =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; items: ActivityItem[]; seen: Date | null; now: Date };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

function Thumb({ path }: { path: string }) {
  const uri = useStorageUrl(path);
  return (
    <View style={styles.thumb}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
    </View>
  );
}

function Row({ row, now }: { row: ActivityRow; now: Date }) {
  const names = actorNames(row.actors);
  const action = activityAction(row);
  const when = timeAgo(row.at, now);
  const first = row.actors[0];
  return (
    <Pressable
      onPress={() =>
        row.type === 'like'
          ? router.push({ pathname: '/home/post/[id]', params: { id: row.postId } })
          : router.push({ pathname: '/home/comments/[id]', params: { id: row.postId } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${names}${action} ${when}`}
      accessibilityHint={row.type === 'like' ? 'Opens the post' : 'Opens the comments'}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`activity-${row.key}`}
    >
      {first ? <Avatar name={first.name} uri={first.photoURL} size={AVATAR} /> : null}
      <AppText variant="subhead" style={styles.text} numberOfLines={3}>
        <AppText variant="subhead" weight="600">
          {names}
        </AppText>
        {action}{' '}
        <AppText variant="subhead" color={colors.textSecondary}>
          {when}
        </AppText>
      </AppText>
      {row.photoPath ? <Thumb path={row.photoPath} /> : null}
    </Pressable>
  );
}

/** Activity: likes, comments and replies on your posts, newest first. */
export function ActivityScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const { blocked } = useHiddenContent(uid);
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let live = true;
      Promise.all([fetchActivity(uid), fetchActivitySeen(uid)]).then(
        ([items, seen]) => {
          if (!live) return;
          setLoaded({ state: 'ready', items, seen, now: new Date() });
          // What's new stays marked New while they're here; next time it's Earlier.
          markActivitySeen(uid).catch(() => {});
        },
        () => live && setLoaded({ state: 'error' }),
      );
      return () => {
        live = false;
      };
      // attempt isn't read; bumping it is how Try again reloads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, attempt]),
  );

  const sections = useMemo(
    () =>
      loaded.state === 'ready'
        ? activitySections(loaded.items, loaded.seen, blocked).map((s) => ({
            title: s.title,
            data: s.rows,
          }))
        : [],
    [loaded, blocked],
  );
  const now = loaded.state === 'ready' ? loaded.now : new Date();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader title="Activity" onBack={goBack} backTestID="activity-back" />
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => <Row row={item} now={now} />}
        renderSectionHeader={({ section }) => (
          <AppText
            variant="headline"
            accessibilityRole="header"
            style={styles.sectionTitle}
            testID={`activity-section-${section.title.toLowerCase()}`}
          >
            {section.title}
          </AppText>
        )}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          loaded.state === 'loading' ? (
            <AppText
              variant="callout"
              color={colors.textSecondary}
              align="center"
              style={styles.message}
            >
              Loading…
            </AppText>
          ) : loaded.state === 'error' ? (
            <View style={styles.message}>
              <AppText variant="callout" color={colors.textSecondary} align="center">
                Couldn’t load your activity.
              </AppText>
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => {
                  setLoaded({ state: 'loading' });
                  setAttempt((n) => n + 1);
                }}
                testID="activity-retry"
              />
            </View>
          ) : (
            <View style={styles.message} testID="activity-empty">
              <AppText variant="headline" align="center">
                No activity yet
              </AppText>
              <AppText variant="callout" color={colors.textSecondary} align="center">
                When brothers like or comment on your posts, you’ll see it here.
              </AppText>
            </View>
          )
        }
        contentContainerStyle={styles.content}
        testID="activity-list"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: MIN_TOUCH,
  },
  pressed: { opacity: 0.6 },
  text: { flex: 1 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.backgroundGrouped,
  },
  message: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
});
