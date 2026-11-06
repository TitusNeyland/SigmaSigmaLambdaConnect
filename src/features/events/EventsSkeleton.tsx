import { StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH, radius, spacing } from '@/theme';
import { Skeleton, SkeletonGroup } from '@/ui';

const LINE = 12;
const ROWS = 3;

/** The Events list's shape while it loads: the Next up card, then a few rows. */
export function EventsSkeleton() {
  return (
    <SkeletonGroup label="Loading events" style={styles.wrap} testID="events-loading">
      <View style={styles.card}>
        <Skeleton radius={0} style={styles.hero} />
        <View style={styles.cardBody}>
          <Skeleton width="35%" height={LINE} />
          <Skeleton width="70%" height={LINE + spacing.xs} />
          <Skeleton width="55%" height={LINE} />
        </View>
      </View>
      <View style={styles.list}>
        {Array.from({ length: ROWS }, (_, i) => (
          <View key={i} style={styles.row}>
            <Skeleton width={MIN_TOUCH} height={MIN_TOUCH} radius={radius.md} />
            <View style={styles.lines}>
              <Skeleton width="60%" height={LINE} />
              <Skeleton width="40%" height={LINE} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.background },
  hero: { width: '100%', aspectRatio: 16 / 9 },
  cardBody: { padding: spacing.lg, gap: spacing.sm },
  list: {
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  lines: { flex: 1, gap: spacing.xs },
});
