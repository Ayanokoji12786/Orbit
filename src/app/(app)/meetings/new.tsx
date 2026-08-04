import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { AppText, Button, DateTimeField, GradientBackground } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { createMeeting } from '@/features/meetings/api';
import { scheduleMeetingReminder } from '@/lib/notifications';

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
  const [startingInstant, setStartingInstant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startInstantMeeting = async () => {
    setError(null);
    setStartingInstant(true);
    try {
      const meeting = await createMeeting({ title: title.trim() || 'Instant Meeting', startsAt: new Date() });
      router.replace(`/meeting/${meeting.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the meeting.');
      setStartingInstant(false);
    }
  };

  const schedule = async () => {
    setError(null);
    setScheduling(true);
    try {
      const meeting = await createMeeting({ title: title.trim(), startsAt, durationMinutes: 30 });
      await scheduleMeetingReminder(meeting);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule the meeting.');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <GradientBackground>
      <ScreenHeader title="New Meeting" />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <Button label="Start Instant Meeting" onPress={startInstantMeeting} loading={startingInstant} />

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

        {error && (
          <AppText variant="caption" color="error" style={{ textAlign: 'center' }}>
            {error}
          </AppText>
        )}

        <Button
          label="Schedule Meeting"
          variant="secondary"
          disabled={!title.trim()}
          loading={scheduling}
          onPress={schedule}
        />
        <AppText variant="caption" color="textTertiary" style={{ textAlign: 'center' }}>
          Reminds you 10 minutes before it starts. Inviting specific people is coming soon — for now, share
          the meeting code from the meeting screen.
        </AppText>
      </View>
    </GradientBackground>
  );
}
