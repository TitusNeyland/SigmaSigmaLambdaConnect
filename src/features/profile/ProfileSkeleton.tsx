import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { spacing } from '@/theme';
import { Skeleton, SkeletonGroup } from '@/ui';

const AVATAR = 86;
const LINE = 12;
const STAT = 20;
const BUTTON = 34;
const GRID_TILES = 6;
const GRID_COLUMNS = 3;

/** Three squares to a row, like the posts grid, while posts load. */
export function GridSkeleton({ tileSize }: { tileSize: number }) {
  return (
    <SkeletonGroup label="Loading posts" style={styles.grid} testID="profile-posts-loading">
      {Array.from({ length: GRID_TILES }, (_, i) => (
        <Skeleton key={i} width={tileSize} height={tileSize} radius={0} />
      ))}
    </SkeletonGroup>
  );
}

/** A whole profile's shape, while the profile itself loads. */
export function ProfileSkeleton() {
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - spacing.xxs * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  return (
    <SkeletonGroup label="Loading profile" style={styles.page} testID="profile-loading">
      <View style={styles.top}>
        <Skeleton width={AVATAR} height={AVATAR} round />
        <View style={styles.stats}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.stat}>
              <Skeleton width={STAT * 1.5} height={STAT} />
              <Skeleton width={STAT * 2.5} height={LINE} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.about}>
        <Skeleton width="45%" height={LINE + spacing.xs} />
        <Skeleton width="65%" height={LINE} />
        <Skeleton width="80%" height={LINE} />
      </View>
      <Skeleton height={BUTTON} />
      <View style={[styles.grid, styles.bleed]}>
        {Array.from({ length: GRID_TILES }, (_, i) => (
          <Skeleton key={i} width={tile} height={tile} radius={0} />
        ))}
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxl },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: spacing.xs },
  about: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
  // The grid runs edge to edge, past the page's side padding.
  bleed: { marginHorizontal: -spacing.xl },
});
