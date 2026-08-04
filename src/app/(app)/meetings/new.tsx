import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { AppText, Button, DateTimeField, GradientBackground } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { scheduleMeetingReminder } from '@/lib/notifications';
import { useMeetingsStore } from '@/stores/meetings-store';

function randomRoomId() {
  return Math.random().toString(36).slice(2, 8);
}

function defaultStartTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date;
}

export default function NewMeeting() {
  const { colors, spacing, radii } = useAppTheme();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStartTime());
  const [scheduling, setScheduling] = useState(false);
  const addMeeting = useMeetingsStore((s) => s.addMeeting);

  const schedule = async () => {
    setScheduling(true);
    const meeting = {
      id: randomRoomId(),
      title: title.trim(),
      startsAt: startsAt.toISOString(),
      durationMinutes: 30,
      participants: [],
      hasPassword: false,
    };
    addMeeting(meeting);
    await scheduleMeetingReminder(meeting);
    setScheduling(false);
    router.back();
  };

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

        <DateTimeField label="Starts" value={startsAt} onChange={setStartsAt} minimumDate={new Date()} />

        <Button
          label="Schedule Meeting"
          variant="secondary"
          disabled={!title.trim()}
          loading={scheduling}
          onPress={schedule}
        />
        <AppText variant="caption" color="textTertiary" style={{ textAlign: 'center' }}>
          Saved on this device and reminds you 10 minutes before it starts. Inviting others needs Orbit's
          backend (Phase 2).
        </AppText>
      </View>
    </GradientBackground>
  );
}
