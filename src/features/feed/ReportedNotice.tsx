import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, palette, radius, spacing } from '@/theme';
import { AppText } from '@/ui';

import { onBlocked, onReported } from './feedEvents';

/** How long the thank-you stays up. */
export const NOTICE_MS = 6000;

/** A short note at the bottom of the screen after a report or a block. Tap to dismiss. */
export function ReportedNotice() {
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    const stopReported = onReported((what) =>
      setNotice({
        title: 'Thanks for reporting',
        body: `Officers will take a look. You won’t see this ${what} anymore, and the author won’t know it was you.`,
      }),
    );
    const stopBlocked = onBlocked((name) =>
      setNotice({
        title: `You blocked ${name}`,
        body: 'They aren’t told. Unblock them any time in Settings.',
      }),
    );
    return () => {
      stopReported();
      stopBlocked();
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;
  return (
    <Pressable
      onPress={() => setNotice(null)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={styles.notice}
      testID="reported-notice"
    >
      <AppText variant="subhead" weight="600" color={palette.onInk}>
        {notice.title}
      </AppText>
      <AppText variant="footnote" color={palette.onInk}>
        {notice.body}
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
