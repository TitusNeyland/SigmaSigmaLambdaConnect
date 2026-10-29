import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { SessionProvider, useSession } from '@/features/auth/session';
import { PushRegistration } from '@/features/notifications/PushRegistration';
import { RoleProvider } from '@/features/roles/RoleProvider';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  // Keep the splash screen up until we know who this is and whether they're approved.
  if (status === 'loading') return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'unverified'}>
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsProfile'}>
        <Stack.Screen name="complete-profile" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'pending'}>
        <Stack.Screen name="pending" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'declined'}>
        <Stack.Screen name="declined" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'error'}>
        <Stack.Screen name="offline" />
      </Stack.Protected>
      {/* Only approved members ever reach chapter content. The security rules enforce the same. */}
      <Stack.Protected guard={status === 'approved'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-post" options={{ presentation: 'modal' }} />
        <Stack.Screen name="guidelines" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SessionProvider>
        <RoleProvider>
          <StatusBar style="dark" />
          <PushRegistration />
          <RootStack />
        </RoleProvider>
      </SessionProvider>
    </AuthProvider>
  );
}
