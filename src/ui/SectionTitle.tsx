import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MIN_TOUCH, spacing } from '@/theme';

import { AppText } from './AppText';

export type SectionTitleProps = {
  title: string;
  /** Beside the title, e.g. a "2 new" chip. */
  badge?: ReactNode;
  /** On the right, e.g. a New button. */
  trailing?: ReactNode;
  testID?: string;
};

/** A bold section heading, with an optional badge and an action on the right. */
export function SectionTitle({ title, badge, trailing, testID }: SectionTitleProps) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.title}>
        <AppText variant="title3" accessibilityRole="header">
          {title}
        </AppText>
        {badge}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
});
