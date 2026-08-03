import { ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { AppText, Avatar, Button, Chip, IconButton } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { useAuthStore } from '@/stores/auth-store';

export default function Profile() {
  const { colors, spacing, radii } = useAppTheme();
  const email = useAuthStore((s) => s.email);
  const displayName = email ? email.split('@')[0] : 'Orbit User';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Profile"
        right={
          <IconButton
            name="create-outline"
            variant="plain"
            accessibilityLabel="Edit profile"
            onPress={() => router.push('/profile/edit')}
          />
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, alignItems: 'center' }}>
        <Avatar name={displayName} size={96} status="online" />
        <AppText variant="displayMedium" style={{ marginTop: spacing.md, textTransform: 'capitalize' }}>
          {displayName}
        </AppText>
        {email && (
          <AppText variant="body" color="textSecondary" style={{ marginTop: 2 }}>
            {email}
          </AppText>
        )}

        <View style={{ marginTop: spacing.sm }}>
          <Chip label="Available" tone="success" />
        </View>

        <View
          style={{
            width: '100%',
            marginTop: spacing.xl,
            padding: spacing.lg,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceElevated,
            gap: spacing.md,
          }}>
          <InfoRow icon="globe-outline" label="Time zone" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
          <InfoRow icon="mail-outline" label="Email" value={email ?? 'Not signed in'} />
        </View>

        <View style={{ width: '100%', marginTop: spacing.xl }}>
          <Button label="Edit profile" variant="secondary" onPress={() => router.push('/profile/edit')} />
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={icon} size={18} color={colors.textTertiary} />
      <AppText variant="caption" color="textTertiary" style={{ width: 80 }}>
        {label}
      </AppText>
      <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}
