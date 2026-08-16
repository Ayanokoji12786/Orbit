import { ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';

import { GradientBackground } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { useAppStateHydrated, useAppStateStore } from '@/stores/app-state-store';
import { useAuthStore } from '@/stores/auth-store';

export default function Gate() {
  const { colors } = useAppTheme();
  const hasOnboarded = useAppStateStore((s) => s.hasOnboarded);
  const appStateHydrated = useAppStateHydrated();
  const authStatus = useAuthStore((s) => s.status);

  // Wait for the persisted flag to load before routing — reading it too early sends
  // returning users back through onboarding on every launch.
  if (!appStateHydrated || authStatus === 'loading') {
    return (
      <GradientBackground>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      </GradientBackground>
    );
  }

  if (!hasOnboarded) return <Redirect href="/(onboarding)" />;

  if (authStatus === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return <Redirect href="/(app)/(tabs)/home" />;
}
