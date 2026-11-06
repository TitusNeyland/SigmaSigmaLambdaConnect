import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { checkInCode } from '@/features/attendance/checkInCode';
import { colors, palette, radius, spacing } from '@/theme';
import { AppText, Avatar, NavHeader } from '@/ui';

import { useProfile } from './useProfileData';

/** The code's widest size; it fills the screen width up to this. */
const MAX_CODE = 280;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/profile');
}

/** The member's check-in code, for an officer to scan at an event. */
export function CheckInCodeScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const profile = useProfile(uid, { own: true });
  const name = profile.state === 'ready' && profile.data ? profile.data.displayName : '';
  const photo = profile.state === 'ready' && profile.data ? profile.data.photoURL : null;
  const { width } = useWindowDimensions();
  const size = Math.min(MAX_CODE, width - spacing.xxl * 2 - spacing.xl * 2);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader title="Check-in code" onBack={goBack} backTestID="code-back" />
      <View style={styles.content}>
        <View style={styles.card}>
          {name ? <Avatar name={name} uri={photo} size={56} /> : null}
          <AppText variant="headline" align="center">
            {name}
          </AppText>
          <View
            style={styles.code}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Check-in code for ${name || 'you'}`}
            testID="check-in-code"
          >
            {uid ? (
              <QRCode
                value={checkInCode(uid)}
                size={size}
                color={palette.ink}
                backgroundColor={palette.bg}
              />
            ) : null}
          </View>
        </View>
        <AppText variant="callout" color={colors.textSecondary} align="center">
          Show this to an officer at an event. They scan it to check you in, and your events and
          service hours count it.
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { flex: 1, padding: spacing.xl, gap: spacing.xl, alignItems: 'center' },
  card: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  code: { padding: spacing.sm, backgroundColor: palette.bg },
});
