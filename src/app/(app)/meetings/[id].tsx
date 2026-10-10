import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';

import { AppText, Avatar, Button, Chip, DateTimeField, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { useNow } from '@/hooks/use-now';
import { cancelMeeting, rescheduleMeeting, setMeetingPassword, useHostMeeting } from '@/features/meetings/api';
import { cancelMeetingReminder, scheduleMeetingReminder } from '@/lib/notifications';
import { formatClockTime, formatCountdown } from '@/utils/datetime';

export default function MeetingDetail() {
  const { id, reminder } = useLocalSearchParams<{ id: string; reminder?: string }>();
  return <MeetingDetailForId key={id} id={id} reminder={reminder} />;
}

function MeetingDetailForId({ id, reminder }: { id: string; reminder?: string }) {
  const { colors, radii, spacing } = useAppTheme();
  const { meeting, loading, error: loadError } = useHostMeeting(id);
  const now = useNow();
  const [editingPassword, setEditingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordOverride, setPasswordOverride] = useState<boolean | null>(null);
  const [editingStart, setEditingStart] = useState(false);
  const [nextStart, setNextStart] = useState(new Date());
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  const saveStart = async () => {
    if (!meeting || savingSchedule) return;
    setSavingSchedule(true);
    setScheduleError(null);
    try {
      const updated = await rescheduleMeeting(meeting.id, nextStart);
      setEditingStart(false);
      try {
        const result = await scheduleMeetingReminder(updated);
        setScheduleNotice(result === 'scheduled'
          ? 'Meeting rescheduled. This device will remind you 10 minutes before it starts.'
          : result === 'permissionDenied'
            ? 'Meeting rescheduled. Enable device notifications to receive a reminder.'
            : 'Meeting rescheduled. It starts too soon for a 10-minute reminder.');
      } catch {
        setScheduleNotice('Meeting rescheduled, but this device could not update its reminder.');
      }
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Could not reschedule the meeting.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const confirmCancel = async () => {
    if (!meeting || savingSchedule) return;
    setSavingSchedule(true);
    setScheduleError(null);
    try {
      await cancelMeeting(meeting.id);
      setConfirmCancellation(false);
      try {
        await cancelMeetingReminder(meeting.id);
        setScheduleNotice('Meeting cancelled. Its reminder was removed from this device.');
      } catch {
        setScheduleNotice('Meeting cancelled, but this device could not remove its reminder.');
      }
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Could not cancel the meeting.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const changePassword = async (nextPassword: string | null) => {
    if (!meeting || savingPassword) return;
    if (nextPassword !== null) {
      if (nextPassword.trim().length < 8) {
        setPasswordError('Use at least 8 characters.');
        return;
      }
    }
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordNotice(null);
    try {
      const hasPassword = await setMeetingPassword(meeting.id, nextPassword);
      setPasswordOverride(hasPassword);
      setPasswordNotice(hasPassword ? 'Meeting password saved.' : 'Meeting password removed.');
      setPassword('');
      setEditingPassword(false);
      setConfirmRemoval(false);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not update the meeting password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!meeting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Meeting Details" />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="calendar-outline"
            title={loading ? 'Loading meeting' : loadError ? 'Could not load meeting' : 'Meeting not found'}
            subtitle={loadError ?? (loading ? 'Checking your meeting details.' : 'Check the meeting link or return to your meetings.')}
          />
        </View>
      </View>
    );
  }

  const startsAt = new Date(meeting.startsAt).getTime();
  const isUpcoming = startsAt > now;
  const isWithinScheduledWindow = now < startsAt + meeting.durationMinutes * 60_000;
  const hasPassword = passwordOverride ?? meeting.hasPassword;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Meeting Details" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <View>
          <Chip label={meeting.cancelledAt ? 'Cancelled' : meeting.endedAt ? 'Ended' : isUpcoming ? formatCountdown(meeting.startsAt) : isWithinScheduledWindow ? 'Started' : 'Past'} tone={isUpcoming && !meeting.cancelledAt && !meeting.endedAt ? 'primary' : 'neutral'} />
          <AppText variant="displayMedium" style={{ marginTop: spacing.sm }}>
            {meeting.title}
          </AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: 2 }}>
            {formatClockTime(meeting.startsAt)} · {meeting.durationMinutes} min
          </AppText>
        </View>

        {reminder && reminder !== 'scheduled' && (
          <AppText variant="caption" color="textSecondary">
            {reminder === 'permissionDenied'
              ? 'Meeting saved. Enable device notifications to receive a reminder.'
              : reminder === 'tooSoon'
                ? 'Meeting saved. It starts too soon for a 10-minute reminder.'
                : 'Meeting saved, but this device could not schedule its reminder.'}
          </AppText>
        )}

        {isUpcoming && !meeting.cancelledAt && !meeting.endedAt && (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="headline">Schedule</AppText>
            {editingStart ? (
              <View style={{ gap: spacing.sm }}>
                <DateTimeField label="New start time" value={nextStart} onChange={setNextStart} minimumDate={new Date()} />
                <Button label="Save new time" onPress={() => { void saveStart(); }} loading={savingSchedule} />
                <Button label="Keep current time" variant="ghost" onPress={() => setEditingStart(false)} />
              </View>
            ) : (
              <Button label="Reschedule meeting" variant="secondary" onPress={() => { setNextStart(new Date(meeting.startsAt)); setEditingStart(true); setScheduleNotice(null); }} />
            )}
          </View>
        )}

        {(isUpcoming || meeting.cancelledAt) && !meeting.endedAt && (
          <View style={{ gap: spacing.sm }}>
            {confirmCancellation ? (
              <>
                <AppText variant="caption" color="textSecondary">Everyone in this meeting will be disconnected, and its code will stop working.</AppText>
                <Button label="Confirm cancellation" variant="destructive" onPress={() => { void confirmCancel(); }} loading={savingSchedule} />
                <Button label="Keep meeting" variant="ghost" onPress={() => setConfirmCancellation(false)} />
              </>
            ) : (
              <Button label={meeting.cancelledAt ? 'Retry room cleanup' : 'Cancel meeting'} variant="ghost" onPress={() => setConfirmCancellation(true)} />
            )}
          </View>
        )}
        {scheduleError && <AppText variant="caption" color="error">{scheduleError}</AppText>}
        {scheduleNotice && <AppText variant="caption" color="success">{scheduleNotice}</AppText>}

        {meeting.participants.length > 0 && (
          <View>
            <AppText variant="headline">Participants</AppText>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {meeting.participants.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Avatar name={p.name} uri={p.avatarUrl} size={36} />
                  <AppText variant="body">{p.name}</AppText>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name={hasPassword ? 'lock-closed' : 'lock-open-outline'} size={16} color={colors.textTertiary} />
          <AppText variant="caption" color="textTertiary">
            {hasPassword ? 'Password protected' : 'No password required'}
          </AppText>
        </View>

        {isWithinScheduledWindow && !meeting.cancelledAt && !meeting.endedAt && (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="headline">Meeting password</AppText>
            <AppText variant="caption" color="textSecondary">
              As host, you can protect this meeting. Share the password separately with people you invite.
            </AppText>
            {editingPassword ? (
              <View style={{ gap: spacing.sm }}>
                <TextInput
                  value={password}
                  onChangeText={(value) => { setPassword(value); setPasswordError(null); }}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  accessibilityLabel="New meeting password"
                  style={{
                    height: 52,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceElevated,
                    paddingHorizontal: spacing.base,
                    color: colors.textPrimary,
                    fontSize: 16,
                  }}
                />
                <Button label="Save password" onPress={() => { void changePassword(password.trim()); }} loading={savingPassword} disabled={!password.trim()} />
                <Button label="Cancel" variant="ghost" onPress={() => { setEditingPassword(false); setPassword(''); setPasswordError(null); }} />
              </View>
            ) : (
              <Button label={hasPassword ? 'Change password' : 'Set password'} variant="secondary" onPress={() => { setEditingPassword(true); setConfirmRemoval(false); setPasswordNotice(null); }} />
            )}
            {hasPassword && !editingPassword && (confirmRemoval ? (
              <View style={{ gap: spacing.sm }}>
                <AppText variant="caption" color="textSecondary">Anyone with the room code will be able to join without a password.</AppText>
                <Button label="Confirm password removal" variant="destructive" onPress={() => { void changePassword(null); }} loading={savingPassword} />
                <Button label="Keep password" variant="ghost" onPress={() => setConfirmRemoval(false)} />
              </View>
            ) : (
              <Button label="Remove password" variant="ghost" onPress={() => { setConfirmRemoval(true); setPasswordNotice(null); }} />
            ))}
            {passwordError && <AppText variant="caption" color="error">{passwordError}</AppText>}
            {passwordNotice && <AppText variant="caption" color="success">{passwordNotice}</AppText>}
          </View>
        )}

        {isWithinScheduledWindow && !meeting.cancelledAt && !meeting.endedAt ? (
          <Button label="Join meeting" onPress={() => router.push(`/meeting/${meeting.roomCode}`)} />
        ) : (
          <AppText variant="caption" color="textTertiary">
            Recordings and AI summaries are not available for this meeting.
          </AppText>
        )}
      </ScrollView>
    </View>
  );
}
