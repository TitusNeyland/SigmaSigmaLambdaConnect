import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { spacing } from '@/theme';
import { Skeleton, SkeletonGroup } from '@/ui';

const AVATAR = 36;
const LINE = 12;

/** One post's shape: author line, a square photo, then a couple of lines. */
function PostShape({ width }: { width: number }) {
  return (
    <View style={styles.post}>
      <View style={styles.header}>
        <Skeleton width={AVATAR} height={AVATAR} round />
        <View style={styles.lines}>
          <Skeleton width="40%" height={LINE} />
          <Skeleton width="60%" height={LINE} />
        </View>
      </View>
      <Skeleton width={width} height={width} radius={0} />
      <View style={styles.body}>
        <Skeleton width="30%" height={LINE} />
        <Skeleton width="85%" height={LINE} />
      </View>
    </View>
  );
}

/** What Home shows while the first posts load. */
export function FeedSkeleton() {
  const { width } = useWindowDimensions();
  return (
    <SkeletonGroup label="Loading posts" testID="feed-loading">
      <PostShape width={width} />
      <PostShape width={width} />
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  post: { paddingBottom: spacing.lg, gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  lines: { flex: 1, gap: spacing.xs },
  body: { paddingHorizontal: spacing.lg, gap: spacing.xs },
});
