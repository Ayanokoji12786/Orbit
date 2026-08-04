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

async function ensureAndroidChannel() {
  if (androidChannelReady) return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Meeting reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
  androidChannelReady = true;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Schedules a local reminder 10 minutes before a meeting starts. No-ops if that's already in the past. */
export async function scheduleMeetingReminder(meeting: { id: string; title: string; startsAt: string }) {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  await ensureAndroidChannel();

  const reminderTime = new Date(new Date(meeting.startsAt).getTime() - 10 * 60 * 1000);
  if (reminderTime.getTime() <= Date.now()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Meeting starting soon',
      body: `${meeting.title} starts in 10 minutes.`,
      data: { meetingId: meeting.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderTime,
    },
  });
}
