import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/features/auth/AuthProvider';
import { useRole } from '@/features/roles/RoleProvider';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { AppText, Button } from '@/ui';

import { ProfileView } from './ProfileView';
import { useProfile, useProfileExtras } from './useProfileData';

function SettingsIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M4 7h16M4 12h16M4 17h16"
        stroke={colors.text}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The signed-in member's own profile (Profile tab). */
export function MyProfileScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const profile = useProfile(uid, { own: true });
  // Members can always see their own attendance.
  const extras = useProfileExtras(uid, true);
  const role = useRole();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText
          variant="title3"
          weight="700"
          numberOfLines={1}
          style={styles.flex}
          accessibilityRole="header"
        >
          Profile
        </AppText>
        <Pressable
          onPress={() => router.push('/profile/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={spacing.sm}
          style={styles.iconButton}
          testID="open-settings"
        >
          <SettingsIcon />
        </Pressable>
      </View>

      {profile.state === 'ready' && profile.data ? (
        <ProfileView
          own
          profile={profile.data}
          roleLabel={role.level === 'member' ? null : role.label}
          stats={extras.stats}
          posts={extras.posts}
          activity={extras.activity}
          onRefresh={extras.reload}
          actions={
            <Button
              title="Edit profile"
              variant="secondary"
              size="small"
              onPress={() => router.push('/profile/edit')}
              style={styles.flex}
              testID="edit-profile"
            />
          }
        />
      ) : (
        <View style={styles.center}>
          <AppText variant="callout" color={colors.textSecondary}>
            {profile.state === 'error' ? 'Couldn’t load your profile.' : 'Loading…'}
          </AppText>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
