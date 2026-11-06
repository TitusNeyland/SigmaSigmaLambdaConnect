import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { openMember } from '@/features/profile/openMember';
import { roleLabel } from '@/features/roles/permissions';
import { colors, spacing } from '@/theme';
import { AppText, Avatar, BackButton, Button, ListRow, ListSection, StatusChip } from '@/ui';

import { entrySubtitle, lineMembers } from './directoryLogic';
import { useDirectory } from './useDirectory';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter/directory');
}

/** Everyone who crossed on one line, like Spring 2019: tap "Initiated …" on a profile. */
export function LineScreen({ term }: { term: string }) {
  const auth = useAuth();
  const me = auth.status === 'signedIn' ? auth.user.uid : '';
  const { value, retry } = useDirectory();
  const brothers = value.state === 'ready' ? lineMembers(value.entries, term) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={goBack} testID="line-back" />
        <View style={styles.flex}>
          <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={1}>
            {term}
          </AppText>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {value.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : value.state === 'error' ? (
          <View style={styles.empty}>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Couldn’t load this line.
            </AppText>
            <Button title="Try again" variant="secondary" onPress={retry} testID="line-retry" />
          </View>
        ) : brothers.length === 0 ? (
          <View style={styles.empty} testID="line-empty">
            <AppText variant="callout" color={colors.textSecondary} align="center">
              No one from this line is in the app yet.
            </AppText>
          </View>
        ) : (
          <ListSection header={brothers.length === 1 ? '1 brother' : `${brothers.length} brothers`}>
            {brothers.map((b) => (
              <ListRow
                key={b.uid}
                title={b.displayName}
                subtitle={entrySubtitle({ ...b, initiationTerm: '' }) || undefined}
                leading={<Avatar name={b.displayName} uri={b.photoURL} size={40} />}
                trailing={b.role ? <StatusChip label={roleLabel(b.role)} tone="gold" /> : undefined}
                showChevron
                onPress={() => openMember(b.uid, me)}
                testID={`line-member-${b.uid}`}
              />
            ))}
          </ListSection>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },
  empty: { paddingTop: spacing.xxl, gap: spacing.sm, alignItems: 'center' },
});
