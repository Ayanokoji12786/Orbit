import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, PressableScale, SectionHeader } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { dmThreadId, useChatStore } from '@/features/chat';
import { mockContacts } from '@/features/home/mock-data';
import type { ChatMessage, Contact } from '@/types/domain';
import { formatRelativeDay } from '@/utils/datetime';

export default function Contacts() {
  const { colors, spacing, radii } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const threads = useChatStore((s) => s.threads);

  const filtered = useMemo(
    () => mockContacts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const favorites = filtered.filter((c) => c.isFavorite);

  const recentConversations = useMemo(() => {
    const withMessages: { contact: Contact; last: ChatMessage }[] = [];
    for (const contact of mockContacts) {
      const last = threads[dmThreadId(contact.id)]?.at(-1);
      if (last) withMessages.push({ contact, last });
    }
    return withMessages.sort((a, b) => new Date(b.last.createdAt).getTime() - new Date(a.last.createdAt).getTime());
  }, [threads]);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + 140,
      }}
      showsVerticalScrollIndicator={false}>
      <AppText variant="displayMedium">Contacts</AppText>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surfaceElevated,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          marginTop: spacing.lg,
          height: 46,
        }}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search contacts"
          placeholderTextColor={colors.textTertiary}
          style={{ flex: 1, color: colors.textPrimary, fontSize: 16 }}
        />
      </View>

      {recentConversations.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Recent conversations" />
          <View style={{ gap: spacing.sm }}>
            {recentConversations.map(({ contact, last }) => (
              <PressableScale
                key={contact.id}
                onPress={() => router.push(`/chat/${contact.id}`)}
                haptic="soft"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceElevated,
                }}>
                <Avatar name={contact.name} size={40} status={contact.status} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium">{contact.name}</AppText>
                  <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                    {last.senderId === 'me' ? 'You: ' : ''}
                    {last.text ?? '📷 Photo'}
                  </AppText>
                </View>
                <AppText variant="micro" color="textTertiary">
                  {formatRelativeDay(last.createdAt)}
                </AppText>
              </PressableScale>
            ))}
          </View>
        </View>
      )}

      {favorites.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Favorites" />
          <View style={{ gap: spacing.sm }}>
            {favorites.map((contact) => (
              <ContactRow key={contact.id} name={contact.name} status={contact.status} onPress={() => router.push(`/contacts/${contact.id}`)} />
            ))}
          </View>
        </View>
      )}

      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title="All contacts" />
        <View style={{ gap: spacing.sm }}>
          {filtered.map((contact) => (
            <ContactRow key={contact.id} name={contact.name} status={contact.status} onPress={() => router.push(`/contacts/${contact.id}`)} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function ContactRow({
  name,
  status,
  onPress,
}: {
  name: string;
  status: 'online' | 'away' | 'offline';
  onPress: () => void;
}) {
  const { spacing, radii, colors } = useAppTheme();

  return (
    <PressableScale
      onPress={onPress}
      haptic="soft"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceElevated,
      }}>
      <Avatar name={name} size={40} status={status} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyMedium">{name}</AppText>
        <AppText variant="caption" color="textSecondary" style={{ textTransform: 'capitalize' }}>
          {status}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </PressableScale>
  );
}
