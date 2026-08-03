import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';

import { CustomTabButton } from '@/components/navigation/CustomTabButton';
import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <FloatingTabBar>
          <TabTrigger name="home" href="/home" asChild>
            <CustomTabButton icon="home" label="Home" />
          </TabTrigger>
          <TabTrigger name="meetings" href="/meetings" asChild>
            <CustomTabButton icon="videocam" label="Meetings" />
          </TabTrigger>
          <TabTrigger name="contacts" href="/contacts" asChild>
            <CustomTabButton icon="people" label="Contacts" />
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <CustomTabButton icon="settings-sharp" label="Settings" />
          </TabTrigger>
        </FloatingTabBar>
      </TabList>
    </Tabs>
  );
}
