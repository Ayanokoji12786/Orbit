import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';

const MEETING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function useMeetingReminderNavigation() {
  useEffect(() => {
    const openMeeting = (response: Notifications.NotificationResponse) => {
      const meetingId = response.notification.request.content.data?.meetingId;
      if (typeof meetingId !== 'string' || !MEETING_ID.test(meetingId)) return;
      Notifications.clearLastNotificationResponse();
      router.push({ pathname: '/meetings/[id]', params: { id: meetingId } });
    };

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) openMeeting(lastResponse);
    const subscription = Notifications.addNotificationResponseReceivedListener(openMeeting);
    return () => subscription.remove();
  }, []);
}

export default function AppLayout() {
  useMeetingReminderNavigation();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile/index" options={{ presentation: 'card' }} />
      <Stack.Screen name="profile/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="recordings/index" options={{ presentation: 'card' }} />
      <Stack.Screen name="recordings/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="notifications/index" options={{ presentation: 'card' }} />
      <Stack.Screen name="contacts/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="chat/[contactId]" options={{ presentation: 'card' }} />
      <Stack.Screen name="meetings/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="meetings/join" options={{ presentation: 'modal' }} />
      <Stack.Screen name="meetings/[id]" options={{ presentation: 'card' }} />
    </Stack>
  );
}
