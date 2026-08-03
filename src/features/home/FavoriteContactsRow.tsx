import { ScrollView, View } from 'react-native';

import { AppText, Avatar, PressableScale } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import type { Contact } from '@/types/domain';

type Props = {
  contacts: Contact[];
  onPressContact: (contact: Contact) => void;
};

export function FavoriteContactsRow({ contacts, onPressContact }: Props) {
  const { spacing } = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg }}>
      {contacts.map((contact) => (
        <PressableScale key={contact.id} onPress={() => onPressContact(contact)} haptic="soft">
          <View style={{ alignItems: 'center', gap: 6, width: 60 }}>
            <Avatar name={contact.name} uri={contact.avatarUrl} size={52} status={contact.status} />
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {contact.name.split(' ')[0]}
            </AppText>
          </View>
        </PressableScale>
      ))}
    </ScrollView>
  );
}
