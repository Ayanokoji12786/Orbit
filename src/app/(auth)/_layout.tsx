import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';

import { useAppTheme } from '@/design-system/useAppTheme';
import { useAuthStore } from '@/stores/auth-store';

export default function AuthLayout() {
  const status = useAuthStore((state) => state.status);
  const { colors } = useAppTheme();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (status === 'signedIn') return <Redirect href="/(app)/(tabs)/home" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
