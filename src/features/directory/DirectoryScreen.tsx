import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchDirectory, type DirectoryEntry } from '@/data/directory';
import { roleLabel } from '@/features/roles/permissions';
import { colors, spacing } from '@/theme';
import {
  AppText,
  Avatar,
  Button,
  FilterChips,
  ListRow,
  ListSection,
  NavHeader,
  SearchField,
  StatusChip,
} from '@/ui';

import { buildSections, entrySubtitle, FILTERS, type DirectoryFilter } from './directoryLogic';

type State =
  { state: 'loading' } | { state: 'ready'; entries: DirectoryEntry[] } | { state: 'error' };

const EMPTY_COPY: Record<DirectoryFilter, string> = {
  all: 'No brothers match your search.',
  officers: 'No officers match.',
  mentors:
    'No mentors match. Brothers show up here when their headline or interests mention mentoring.',
  recent: 'No recent initiates match.',
};

function goBackToChapter() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter');
}

export function DirectoryScreen() {
  const [value, setValue] = useState<State>({ state: 'loading' });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('all');

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    fetchDirectory().then(
      (entries) => live && setValue({ state: 'ready', entries }),
      () => live && setValue({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  function retry() {
    setValue({ state: 'loading' });
    setAttempt((n) => n + 1);
  }

  const sections = useMemo(
    () =>
      value.state === 'ready'
        ? buildSections(value.entries, { search, filter, currentYear: new Date().getFullYear() })
        : [],
    [value, search, filter],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader onBack={goBackToChapter} backTestID="directory-back" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="largeTitle" accessibilityRole="header">
          Directory
        </AppText>
        <SearchField
          value={search}
          onChangeText={setSearch}
          label="Search name, job or interest"
          testID="directory-search"
        />
        <FilterChips
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          accessibilityLabel="Filter brothers"
          testID="directory-filter"
        />
        {value.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : value.state === 'error' ? (
          <View style={styles.empty}>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              Couldn’t load the directory.
            </AppText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={retry}
              testID="directory-retry"
            />
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.empty} testID="directory-empty">
            <AppText variant="headline" align="center">
              No one found
            </AppText>
            <AppText variant="callout" color={colors.textSecondary} align="center">
              {EMPTY_COPY[filter]}
            </AppText>
          </View>
        ) : (
          sections.map((section) => (
            <ListSection key={section.letter} header={section.letter}>
              {section.data.map((entry) => (
                <ListRow
                  key={entry.uid}
                  title={entry.displayName}
                  subtitle={entrySubtitle(entry) || undefined}
                  leading={<Avatar name={entry.displayName} uri={entry.photoURL} size={40} />}
                  trailing={
                    entry.role ? (
                      <StatusChip
                        label={roleLabel(entry.role)}
                        tone="gold"
                        testID={`role-${entry.uid}`}
                      />
                    ) : undefined
                  }
                  showChevron
                  onPress={() =>
                    router.push({ pathname: '/chapter/member/[uid]', params: { uid: entry.uid } })
                  }
                  testID={`member-${entry.uid}`}
                />
              ))}
            </ListSection>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },
  empty: { paddingTop: spacing.xxl, gap: spacing.sm, alignItems: 'center' },
});
