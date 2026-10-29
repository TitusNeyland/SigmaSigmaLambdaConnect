import { StyleSheet, View } from 'react-native';

import { palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export type ChipTone = 'gold' | 'success' | 'warning' | 'neutral' | 'ink';

const TONES: Record<ChipTone, { bg: string; fg: string }> = {
  gold: { bg: palette.goldSoft, fg: palette.goldSoftText },
  success: { bg: palette.successSoft, fg: palette.success },
  warning: { bg: palette.warningSoft, fg: palette.warning },
  neutral: { bg: palette.fill, fg: palette.ink },
  ink: { bg: palette.ink, fg: palette.onInk },
};

export type StatusChipProps = {
  label: string;
  tone?: ChipTone;
  testID?: string;
};

/** Small rounded label for roles and statuses, e.g. "Service Chair" or "At risk". */
export function StatusChip({ label, tone = 'neutral', testID }: StatusChipProps) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]} testID={testID}>
      <AppText variant="caption" weight="600" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

export const chipTones = TONES;

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    minHeight: 22,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
});
