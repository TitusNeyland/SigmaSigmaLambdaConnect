import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Button, haptics, TextField } from '@/ui';

import {
  addBusiness,
  addInterest,
  INDUSTRIES,
  MAX_BUSINESSES,
  MAX_INTERESTS,
  SUGGESTED_INTERESTS,
  toggleIndustry,
  toggleInterest,
} from './aboutYou';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** A pill to tap on or off. Picked ones are filled black, like the rest of the app. */
function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
      testID={testID}
    >
      <AppText variant="subhead" weight="600" color={selected ? palette.onInk : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Pick one line of work. Tap it again to clear. */
export function IndustryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (industry: string) => void;
}) {
  // An industry typed elsewhere (not in the list) still shows, picked.
  const options =
    value && !INDUSTRIES.some((i) => i === value) ? [value, ...INDUSTRIES] : INDUSTRIES;
  return (
    <View style={styles.wrap} accessibilityLabel="Industry" testID="industry-picker">
      {options.map((industry) => (
        <Chip
          key={industry}
          label={industry}
          selected={industry === value}
          onPress={() => onChange(toggleIndustry(value, industry))}
          testID={`industry-${slug(industry)}`}
        />
      ))}
    </View>
  );
}

/** Pick interests from suggestions, or add your own. Up to 10. */
export function InterestPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (interests: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const own = value.filter(
    (v) => !SUGGESTED_INTERESTS.some((s) => s.toLowerCase() === v.toLowerCase()),
  );

  function add() {
    const result = addInterest(value, draft);
    if ('error' in result) return setError(result.error);
    onChange(result.interests);
    setDraft('');
    setError(null);
  }

  return (
    <View style={styles.group}>
      <AppText variant="footnote" weight="600" color={colors.textSecondary}>
        {`Interests (${value.length}/${MAX_INTERESTS})`}
      </AppText>
      <View style={styles.wrap} testID="interest-picker">
        {[...SUGGESTED_INTERESTS, ...own].map((interest) => (
          <Chip
            key={interest}
            label={interest}
            selected={value.some((v) => v.toLowerCase() === interest.toLowerCase())}
            onPress={() => onChange(toggleInterest(value, interest))}
            testID={`interest-${slug(interest)}`}
          />
        ))}
      </View>
      <View style={styles.addRow}>
        <View style={styles.flex}>
          <TextField
            label="Add your own"
            value={draft}
            onChangeText={(v) => {
              setDraft(v);
              setError(null);
            }}
            onSubmitEditing={add}
            returnKeyType="done"
            error={error ?? undefined}
            testID="interest-input"
          />
        </View>
        <Button
          title="Add"
          variant="secondary"
          size="small"
          onPress={add}
          disabled={value.length >= MAX_INTERESTS}
          testID="interest-add"
          style={styles.addButton}
        />
      </View>
    </View>
  );
}

function RemoveIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M6 6l12 12M18 6 6 18"
        stroke={colors.textSecondary}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Businesses he owns, up to 3: type a name, Add, and remove any with ×. */
export function BusinessList({
  value,
  onChange,
  draft: heldDraft,
  onDraftChange,
}: {
  value: string[];
  onChange: (businesses: string[]) => void;
  /** The name being typed, when the screen needs it (sign up adds it on Continue). */
  draft?: string;
  onDraftChange?: (draft: string) => void;
}) {
  const [ownDraft, setOwnDraft] = useState('');
  const draft = heldDraft ?? ownDraft;
  const setDraft = onDraftChange ?? setOwnDraft;
  const [error, setError] = useState<string | null>(null);
  const full = value.length >= MAX_BUSINESSES;

  function add() {
    const result = addBusiness(value, draft);
    if ('error' in result) return setError(result.error);
    haptics.select();
    onChange(result.businesses);
    setDraft('');
    setError(null);
  }

  return (
    <View style={styles.group}>
      {value.length > 0 ? (
        <View style={styles.list} testID="business-list">
          {value.map((name, i) => (
            <View key={name} style={[styles.business, i > 0 && styles.divider]}>
              <AppText variant="body" style={styles.flex} numberOfLines={1}>
                {name}
              </AppText>
              <Pressable
                onPress={() => onChange(value.filter((b) => b !== name))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${name}`}
                hitSlop={spacing.md}
                style={styles.remove}
                testID={`business-remove-${i + 1}`}
              >
                <RemoveIcon />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {!full ? (
        <View style={styles.addRow}>
          <View style={styles.flex}>
            <TextField
              label={value.length ? 'Add another' : 'Business name'}
              placeholder="Like Sample Realty Group"
              value={draft}
              onChangeText={(v) => {
                setDraft(v);
                setError(null);
              }}
              onSubmitEditing={add}
              returnKeyType="done"
              autoCapitalize="words"
              error={error ?? undefined}
              testID="business-input"
            />
          </View>
          <Button
            title="Add"
            variant="secondary"
            size="small"
            onPress={add}
            testID="business-add"
            style={styles.addButton}
          />
        </View>
      ) : (
        <AppText variant="footnote" color={colors.textSecondary}>
          {`That’s the most you can add (${MAX_BUSINESSES}).`}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH - spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: palette.ink },
  pressed: { opacity: 0.7 },
  group: { gap: spacing.md },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  addButton: { marginBottom: spacing.xxs },
  flex: { flex: 1 },
  list: { borderRadius: radius.lg, backgroundColor: colors.fill, paddingHorizontal: spacing.md },
  business: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH, gap: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  remove: { width: MIN_TOUCH / 2, alignItems: 'center' },
});
