import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile/index" options={{ presentation: 'card' }} />
      <Stack.Screen name="profile/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="recordings/index" options={{ presentation: 'card' }} />
      <Stack.Screen name="recordings/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="notifications/index" options={{ presentation: 'card' }} />
      <Stack.Screen name="contacts/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="meetings/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="meetings/join" options={{ presentation: 'modal' }} />
      <Stack.Screen name="meetings/[id]" options={{ presentation: 'card' }} />
    </Stack>
  );
}
