import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';

import { AppText, Avatar, Button, Chip, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { useNow } from '@/hooks/use-now';
import { setMeetingPassword, usePastMeetings, useUpcomingMeetings } from '@/features/meetings/api';
import { formatClockTime, formatCountdown } from '@/utils/datetime';

export default function MeetingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MeetingDetailForId key={id} id={id} />;
}

function MeetingDetailForId({ id }: { id: string }) {
  const { colors, radii, spacing } = useAppTheme();
  const upcoming = useUpcomingMeetings();
  const past = usePastMeetings();
  const now = useNow();
  const meeting = [...upcoming, ...past].find((m) => m.id === id);
  const [editingPassword, setEditingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordOverride, setPasswordOverride] = useState<boolean | null>(null);

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
          <EmptyState icon="calendar-outline" title="Meeting not found" subtitle="It may have been cancelled or already ended." />
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
          <Chip label={isUpcoming ? formatCountdown(meeting.startsAt) : isWithinScheduledWindow ? 'Started' : 'Past'} tone={isUpcoming ? 'primary' : 'neutral'} />
          <AppText variant="displayMedium" style={{ marginTop: spacing.sm }}>
            {meeting.title}
          </AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: 2 }}>
            {formatClockTime(meeting.startsAt)} · {meeting.durationMinutes} min
          </AppText>
        </View>

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

        {isWithinScheduledWindow && (
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

        {isWithinScheduledWindow ? (
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
