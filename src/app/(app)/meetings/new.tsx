import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { AppText, Button, GradientBackground } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';

function randomRoomId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function NewMeeting() {
  const { colors, spacing, radii } = useAppTheme();
  const [title, setTitle] = useState('');

  return (
    <GradientBackground>
      <ScreenHeader title="New Meeting" />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <Button label="Start Instant Meeting" onPress={() => router.replace(`/meeting/${randomRoomId()}`)} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <AppText variant="caption" color="textTertiary">
            or schedule for later
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        <View>
          <AppText variant="captionMedium" color="textSecondary">
            MEETING TITLE
          </AppText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Design Review"
            placeholderTextColor={colors.textTertiary}
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

        <Button label="Schedule Meeting" variant="secondary" disabled={!title} onPress={() => router.back()} />
        <AppText variant="caption" color="textTertiary" style={{ textAlign: 'center' }}>
          Scheduling persists once Orbit is connected to a Supabase project (Phase 2).
        </AppText>
      </View>
    </GradientBackground>
  );
}
