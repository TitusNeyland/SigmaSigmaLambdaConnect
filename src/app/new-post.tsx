import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { AppText, Button } from '@/ui';

// Placeholder for the create post flow (#31, #32). Opens as a modal over the tabs.
export default function NewPostScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Button title="Cancel" variant="plain" size="small" onPress={() => router.back()} />
        <AppText variant="headline">New post</AppText>
        <View style={styles.spacer} />
      </View>
      <View style={styles.body}>
        <AppText variant="callout" color={colors.textSecondary} align="center">
          Picking photos and writing a caption go here (#31, #32).
        </AppText>
      </View>
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
    minHeight: 52,
  },
  spacer: { width: 72 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
});
