import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, MIN_TOUCH, spacing } from '@/theme';
import { AppText, HeaderButton } from '@/ui';

import { GuidelinesContent } from './GuidelinesContent';
import { GUIDELINES_TITLE } from './guidelines';

/** Read-only guidelines, from Settings and the compose screen. */
export function GuidelinesScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.side} />
        <AppText variant="headline" accessibilityRole="header">
          {GUIDELINES_TITLE}
        </AppText>
        <HeaderButton
          title="Done"
          bold
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile/settings'))}
          testID="guidelines-done"
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <GuidelinesContent />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  side: { width: MIN_TOUCH },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
});
