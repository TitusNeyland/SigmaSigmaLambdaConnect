import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, palette, spacing } from '@/theme';
import { AppText, Button } from '@/ui';

export function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <View style={styles.monogram}>
          <AppText variant="title" color={palette.gold}>
            ΣΣΛ
          </AppText>
        </View>
        <AppText variant="largeTitle" align="center" accessibilityRole="header">
          Sigma Sigma Lambda
        </AppText>
        <AppText variant="callout" color={colors.textSecondary} align="center">
          The chapter feed, events and brotherhood, in one place. Private to approved members.
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button title="Create account" onPress={() => router.push('/sign-up')} fullWidth />
        <Button
          title="Sign in"
          variant="secondary"
          onPress={() => router.push('/sign-in')}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  monogram: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actions: { gap: spacing.md, paddingBottom: spacing.sm },
});
