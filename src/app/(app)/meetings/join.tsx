import { useState } from 'react';
import { TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { AppText, Button, GradientBackground } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { parseRoomCode } from '@/utils/meeting-links';

export default function JoinMeeting() {
  const { colors, spacing, radii } = useAppTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const join = () => {
    const roomCode = parseRoomCode(code);
    if (!roomCode) {
      setError('Enter a six-character meeting code or a valid Orbit meeting link.');
      return;
    }
    setError(null);
    router.replace(`/meeting/${roomCode}`);
  };

  return (
    <GradientBackground>
      <ScreenHeader title="Join Meeting" />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <View>
          <AppText variant="captionMedium" color="textSecondary">
            MEETING CODE OR LINK
          </AppText>
          <TextInput
            value={code}
            onChangeText={(value) => { setCode(value); setError(null); }}
            placeholder="orbit.app/j/abc123"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            style={{
              height: 52,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceElevated,
              paddingHorizontal: spacing.base,
              marginTop: spacing.xs,
              color: colors.textPrimary,
              fontSize: 16,
            }}
          />
        </View>

        {error && <AppText variant="caption" color="error">{error}</AppText>}

        <Button
          label="Join"
          disabled={!code.trim()}
          onPress={join}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <AppText variant="caption" color="textTertiary">
            or
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        <View
          style={{
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.xl,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <Ionicons name="qr-code-outline" size={40} color={colors.textTertiary} />
          <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            QR scanning needs camera access — enabled once expo-camera is wired in Phase 2.
          </AppText>
        </View>
      </View>
    </GradientBackground>
  );
}
