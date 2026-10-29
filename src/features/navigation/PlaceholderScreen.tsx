import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { AppText } from '@/ui';

export type PlaceholderScreenProps = {
  title: string;
  /** What will live here and which issue builds it. */
  note: string;
  children?: ReactNode;
};

/** Stand-in for a tab until its real screen is built. Uses an iOS large title. */
export function PlaceholderScreen({ title, note, children }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="largeTitle" accessibilityRole="header">
          {title}
        </AppText>
        <View style={styles.note}>
          <AppText variant="callout" color={colors.textSecondary}>
            {note}
          </AppText>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  note: {
    padding: spacing.lg,
    borderRadius: 14,
    backgroundColor: colors.fill,
  },
});
