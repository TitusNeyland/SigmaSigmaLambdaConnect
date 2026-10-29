import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_ENV } from '@/config/env';
import { app } from '@/data/firebase';
import { colors, palette, spacing } from '@/theme';
import { AppText } from '@/ui';

// Placeholder home screen. The tab bar shell (#5) replaces this.
export default function Index() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.monogram}>
          <AppText variant="title2" color={palette.gold}>
            ΣΣΛ
          </AppText>
        </View>
        <AppText variant="title2" align="center">
          Sigma Sigma Lambda Connect
        </AppText>
        <AppText variant="callout" color={colors.textSecondary}>
          Firebase: {app.options.projectId} ({APP_ENV})
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
  },
  monogram: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
