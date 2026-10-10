import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let androidChannelReady = Platform.OS !== 'android';
const REMINDER_MINUTES = 10;

export type ReminderResult = 'scheduled' | 'tooSoon' | 'permissionDenied';

function reminderIdentifier(meetingId: string) {
  return `orbit-meeting-${meetingId}`;
}

async function ensureAndroidChannel() {
  if (androidChannelReady) return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Meeting reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
  androidChannelReady = true;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Removes every local reminder for a meeting, including identifiers from older app versions. */
export async function cancelMeetingReminder(meetingId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const matches = scheduled.filter((request) =>
    request.identifier === reminderIdentifier(meetingId) || request.content.data?.meetingId === meetingId,
  );
  await Promise.all(matches.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
}

/** Replaces a meeting's local reminder after creation or rescheduling. */
export async function scheduleMeetingReminder(meeting: { id: string; title: string; startsAt: string }): Promise<ReminderResult> {
  await cancelMeetingReminder(meeting.id);
  const reminderTime = new Date(new Date(meeting.startsAt).getTime() - REMINDER_MINUTES * 60 * 1000);
  if (!Number.isFinite(reminderTime.getTime()) || reminderTime.getTime() <= Date.now()) return 'tooSoon';
  if (!(await ensureNotificationPermission())) return 'permissionDenied';

  await Notifications.scheduleNotificationAsync({
    identifier: reminderIdentifier(meeting.id),
    content: {
      title: 'Meeting starting soon',
      body: `${meeting.title} starts in 10 minutes.`,
      data: { meetingId: meeting.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderTime,
      channelId: 'default',
    },
  });
  return 'scheduled';
}
