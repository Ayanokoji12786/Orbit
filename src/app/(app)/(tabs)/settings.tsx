import { ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, Button, PressableScale } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { isFirebaseConfigured } from '@/lib/firebase';
import { signOut } from '@/features/auth/api';
import { useAuthStore } from '@/stores/auth-store';

const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; href: Href }[] = [
  { icon: 'color-palette-outline', label: 'Appearance', href: '/settings/appearance' },
  { icon: 'notifications-outline', label: 'Notifications', href: '/settings/notifications' },
  { icon: 'lock-closed-outline', label: 'Privacy & Security', href: '/settings/privacy' },
  { icon: 'accessibility-outline', label: 'Accessibility', href: '/settings/accessibility' },
  { icon: 'hardware-chip-outline', label: 'Devices', href: '/settings/devices' },
];

export default function Settings() {
  const { spacing, radii, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const email = useAuthStore((s) => s.email);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + 140,
      }}
      showsVerticalScrollIndicator={false}>
      <AppText variant="displayMedium">Settings</AppText>

      <PressableScale onPress={() => router.push('/profile')} haptic="soft" style={{ marginTop: spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceElevated,
          }}>
          <Avatar name={email ?? 'Orbit User'} size={48} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyMedium">{email ?? 'Orbit User'}</AppText>
            <AppText variant="caption" color="textSecondary">
              View profile
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </View>
      </PressableScale>

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        {rows.map((row) => (
          <PressableScale key={row.label} onPress={() => router.push(row.href)} haptic="soft">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceElevated,
              }}>
              <Ionicons name={row.icon} size={20} color={colors.textPrimary} />
              <AppText variant="body" style={{ flex: 1 }}>
                {row.label}
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </View>
          </PressableScale>
        ))}
      </View>

      {!isFirebaseConfigured && (
        <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
          Connect a Firebase project to enable sign-out and live account data.
        </AppText>
      )}

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label="Sign Out"
          variant="destructive"
          disabled={!isFirebaseConfigured}
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/sign-in');
          }}
        />
      </View>
    </ScrollView>
  );
}
