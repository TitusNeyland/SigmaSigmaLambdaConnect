import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, palette, radius, spacing } from '@/theme';
import { AppText } from '@/ui';

import { onReported } from './feedEvents';

/** How long the thank-you stays up. */
export const NOTICE_MS = 6000;

/** A short thank-you at the bottom of the screen after a report. Tap to dismiss. */
export function ReportedNotice() {
  const [what, setWhat] = useState<'post' | 'comment' | null>(null);

  useEffect(() => onReported(setWhat), []);
  useEffect(() => {
    if (!what) return;
    const t = setTimeout(() => setWhat(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [what]);

  if (!what) return null;
  return (
    <Pressable
      onPress={() => setWhat(null)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={styles.notice}
      testID="reported-notice"
    >
      <AppText variant="subhead" weight="600" color={palette.onInk}>
        Thanks for reporting
      </AppText>
      <AppText variant="footnote" color={palette.onInk}>
        Officers will take a look. You won’t see this {what} anymore, and the author won’t know it
        was you.
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    padding: spacing.md,
    gap: spacing.xxs,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
});
