import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fetchDirectory, type DirectoryEntry } from '@/data/directory';
import { roleLabel } from '@/features/roles/permissions';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { openMember } from '@/features/profile/openMember';
import {
  AppText,
  Avatar,
  BackButton,
  BottomSheet,
  Button,
  haptics,
  FilterChips,
  ListRow,
  ListSection,
  SearchField,
  StatusChip,
} from '@/ui';

import {
  buildSections,
  entrySubtitle,
  facetOptions,
  FILTERS,
  NO_REFINEMENTS,
  type DirectoryFilter,
  type Refinements,
} from './directoryLogic';

type Facet = 'industry' | 'interest' | 'line';

const FACETS: Record<Facet, { label: string; any: string; title: string }> = {
  industry: { label: 'Industry', any: 'Any industry', title: 'Industry' },
  interest: { label: 'Interest', any: 'Any interest', title: 'Interest' },
  line: { label: 'Line', any: 'Every line', title: 'Line' },
};

function DownIcon({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path d="m6 9 6 6 6-6" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

/** A pill under the filters: a choice to narrow by, filled black when it's on. */
function RefinePill({
  label,
  on,
  menu,
  onPress,
  testID,
}: {
  label: string;
  on: boolean;
  /** Opens a list to pick from, rather than turning on and off. */
  menu?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const color = on ? palette.onInk : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && styles.pressed]}
      testID={testID}
    >
      <AppText variant="subhead" weight="600" color={color} numberOfLines={1}>
        {label}
      </AppText>
      {menu ? <DownIcon color={color} /> : null}
    </Pressable>
  );
}

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
  const auth = useAuth();
  const me = auth.status === 'signedIn' ? auth.user.uid : '';
  const [value, setValue] = useState<State>({ state: 'loading' });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('all');
  const [refine, setRefine] = useState<Refinements>(NO_REFINEMENTS);
  const [facet, setFacet] = useState<Facet | null>(null);

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
        ? buildSections(value.entries, {
            search,
            filter,
            refine,
            currentYear: new Date().getFullYear(),
          })
        : [],
    [value, search, filter, refine],
  );
  const refined = refine.industry || refine.interest || refine.line || refine.owners;
  const options = useMemo(
    () => (facet && value.state === 'ready' ? facetOptions(value.entries, facet) : []),
    [facet, value],
  );

  function pick(next: string | null) {
    if (!facet) return;
    haptics.select();
    setRefine((r) => ({ ...r, [facet]: next }));
    setFacet(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header} testID="directory-header">
        <BackButton onPress={goBackToChapter} testID="directory-back" />
        <AppText variant="largeTitle" accessibilityRole="header">
          Directory
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.refine}
          testID="directory-refine"
        >
          {(Object.keys(FACETS) as Facet[]).map((f) => (
            <RefinePill
              key={f}
              label={refine[f] ?? FACETS[f].label}
              on={refine[f] !== null}
              menu
              onPress={() => setFacet(f)}
              testID={`refine-${f}`}
            />
          ))}
          <RefinePill
            label="Owns a business"
            on={refine.owners}
            onPress={() => {
              haptics.select();
              setRefine((r) => ({ ...r, owners: !r.owners }));
            }}
            testID="refine-owners"
          />
          {refined ? (
            <RefinePill
              label="Clear"
              on={false}
              onPress={() => setRefine(NO_REFINEMENTS)}
              testID="refine-clear"
            />
          ) : null}
        </ScrollView>
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
              {refined ? 'No brothers match these choices. Try clearing one.' : EMPTY_COPY[filter]}
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
                  onPress={() => openMember(entry.uid, me)}
                  testID={`member-${entry.uid}`}
                />
              ))}
            </ListSection>
          ))
        )}
      </ScrollView>

      <BottomSheet
        visible={facet !== null}
        onClose={() => setFacet(null)}
        title={facet ? FACETS[facet].title : undefined}
        testID="refine-sheet"
      >
        <ScrollView style={styles.sheetList}>
          <ListSection>
            <ListRow
              title={facet ? FACETS[facet].any : ''}
              trailing={
                facet && refine[facet] === null ? (
                  <AppText color={colors.link}>✓</AppText>
                ) : undefined
              }
              onPress={() => pick(null)}
              testID="refine-any"
            />
            {options.map((o) => (
              <ListRow
                key={o.value}
                title={o.value}
                value={String(o.count)}
                trailing={
                  facet && refine[facet] === o.value ? (
                    <AppText color={colors.link}>✓</AppText>
                  ) : undefined
                }
                onPress={() => pick(o.value)}
                testID={`refine-option-${o.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              />
            ))}
          </ListSection>
          {options.length === 0 ? (
            <AppText variant="footnote" color={colors.textSecondary} align="center">
              No brother has added one yet.
            </AppText>
          ) : null}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  // The back chevron sits beside the large title, on one line.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  content: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxxl },
  empty: { paddingTop: spacing.xxl, gap: spacing.sm, alignItems: 'center' },
  refine: { gap: spacing.sm, marginTop: -spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH - spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  pillOn: { backgroundColor: palette.ink, borderColor: palette.ink },
  pressed: { opacity: 0.7 },
  sheetList: { maxHeight: 420 },
});
