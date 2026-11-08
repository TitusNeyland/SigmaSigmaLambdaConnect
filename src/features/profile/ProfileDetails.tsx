import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import type { Profile } from '@/data/profile';
import { colors, spacing } from '@/theme';
import { AppText } from '@/ui';

import { phoneUrl } from './detailsLogic';

type IconKind = 'mail' | 'phone';

const stroke = { stroke: colors.textSecondary, strokeWidth: 1.8 } as const;

/** A small line icon beside a fact, matching the work, business and place icons. */
function DetailIcon({ kind }: { kind: IconKind }) {
  const shapes: Record<IconKind, ReactNode> = {
    mail: (
      <>
        <Rect x={3} y={5} width={18} height={14} rx={2.5} {...stroke} />
        <Path d="m3.5 6.5 8.5 6.5 8.5-6.5" {...stroke} strokeLinejoin="round" />
      </>
    ),
    phone: (
      <Path
        d="M5 3.5h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.6 6.6l1.4-2.3 4.5 1.8V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.1A1.5 1.5 0 0 1 5 3.5z"
        {...stroke}
        strokeLinejoin="round"
      />
    ),
  };
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      {shapes[kind]}
    </Svg>
  );
}

/** One line with an icon. With a url it's a link, like an email address. */
function Fact({
  icon,
  text,
  url,
  hint,
  testID,
}: {
  icon: IconKind;
  text: string;
  url: string | null;
  hint: string;
  testID: string;
}) {
  const body = (
    <>
      <DetailIcon kind={icon} />
      <AppText variant="subhead" color={url ? colors.link : undefined} style={styles.factText}>
        {text}
      </AppText>
    </>
  );
  if (!url) {
    return (
      <View style={styles.fact} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityRole="link"
      accessibilityHint={hint}
      hitSlop={{ top: spacing.md, bottom: spacing.md }}
      style={({ pressed }) => [styles.fact, pressed && styles.pressed]}
      testID={testID}
    >
      {body}
    </Pressable>
  );
}

/** His email, when he chose to show it. It stays up top with his work and city. */
export function EmailFact({ profile }: { profile: Profile }) {
  const email = profile.showEmail ? profile.email.trim() : '';
  if (!email) return null;
  return (
    <Fact
      icon="mail"
      text={email}
      url={`mailto:${email}`}
      hint="Writes him an email"
      testID="profile-email"
    />
  );
}

/** His phone, when he chose to show it. It sits under "More details". */
export function PhoneFact({ profile }: { profile: Profile }) {
  const phone = profile.showPhone ? profile.phone.trim() : '';
  if (!phone) return null;
  return (
    <Fact icon="phone" text={phone} url={phoneUrl(phone)} hint="Calls him" testID="profile-phone" />
  );
}

const styles = StyleSheet.create({
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  factText: { flex: 1 },
  pressed: { opacity: 0.6 },
});
