import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { openMember } from '@/features/profile/openMember';
import { colors, spacing } from '@/theme';
import { AppText, Avatar, BackButton, Button, ListRow, ListSection, SearchField } from '@/ui';

import { brotherBusinesses } from './directoryLogic';
import { useDirectory } from './useDirectory';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter');
}

/** Support a brother: every business a brother owns, each opening its owner's profile. */
export function BusinessesScreen() {
  const auth = useAuth();
  const me = auth.status === 'signedIn' ? auth.user.uid : '';
  const { value, retry } = useDirectory();
  const [search, setSearch] = useState('');
  const all = useMemo(
    () => (value.state === 'ready' ? brotherBusinesses(value.entries) : []),
    [value],
  );
  const shown = useMemo(
    () => (value.state === 'ready' ? brotherBusinesses(value.entries, search) : []),
    [value, search],
  );
  const mine = all.some((b) => b.owner.uid === me);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={goBack} testID="businesses-back" />
        <AppText variant="largeTitle" accessibilityRole="header">
          Businesses
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="callout" color={colors.textSecondary}>
          Brother-owned businesses. Support a brother.
        </AppText>
        {all.length > 0 ? (
          <SearchField
            value={search}
            onChangeText={setSearch}
            label="Search business, owner or field"
            testID="businesses-search"
          />
        ) : null}
        {value.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : value.state === 'error' ? (
          <View style={styles.empty}>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Couldn’t load businesses.
            </AppText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={retry}
              testID="businesses-retry"
            />
          </View>
        ) : all.length === 0 ? (
          <View style={styles.empty} testID="businesses-empty">
            <AppText variant="headline" align="center">
              No businesses yet
            </AppText>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Brothers who own a business can add it in Edit profile.
            </AppText>
          </View>
        ) : shown.length === 0 ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            No businesses match your search.
          </AppText>
        ) : (
          <ListSection header={all.length === 1 ? '1 business' : `${all.length} businesses`}>
            {shown.map(({ name, owner }) => (
              <ListRow
                key={`${owner.uid}:${name}`}
                title={name}
                subtitle={[owner.displayName, owner.industry].filter(Boolean).join(' · ')}
                leading={<Avatar name={owner.displayName} uri={owner.photoURL} size={40} />}
                showChevron
                onPress={() => openMember(owner.uid, me)}
                testID={`business-${owner.uid}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              />
            ))}
          </ListSection>
        )}
        {value.state === 'ready' && !mine ? (
          <Button
            title="Own a business? Add it"
            variant="plain"
            onPress={() => router.push('/profile/edit', { withAnchor: true })}
            testID="businesses-add-yours"
          />
        ) : null}
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
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },
  empty: { paddingTop: spacing.xl, gap: spacing.sm, alignItems: 'center' },
});
