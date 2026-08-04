import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, EmptyState, IconButton, PressableScale, SectionHeader } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { useRecentDms } from '@/features/chat/api';
import { addContactByEmail, useContacts } from '@/features/contacts/api';
import { useAuthStore } from '@/stores/auth-store';
import type { ChatMessage, Contact } from '@/types/domain';
import { formatRelativeDay } from '@/utils/datetime';

export default function Contacts() {
  const { colors, spacing, radii } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const { contacts, loading } = useContacts();
  const recentDms = useRecentDms();
  const myUid = useAuthStore((s) => s.uid);

  const recentConversations = useMemo(() => {
    const withContact: { contact: Contact; lastMessage: ChatMessage }[] = [];
    for (const thread of recentDms) {
      const contact = contacts.find((c) => c.id === thread.otherUid);
      if (contact) withContact.push({ contact, lastMessage: thread.lastMessage });
    }
    return withContact;
  }, [recentDms, contacts]);

  const [addingOpen, setAddingOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addStatus, setAddStatus] = useState<{ kind: 'sending' | 'error' | 'ok'; message?: string } | null>(null);

  const filtered = useMemo(
    () => contacts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [contacts, query],
  );
  const favorites = filtered.filter((c) => c.isFavorite);

  const submitAddContact = async () => {
    setAddStatus({ kind: 'sending' });
    try {
      const result = await addContactByEmail(addEmail);
      if (result === 'added') {
        setAddStatus({ kind: 'ok', message: 'Added!' });
        setAddEmail('');
        setTimeout(() => setAddingOpen(false), 800);
      } else if (result === 'exists') {
        setAddStatus({ kind: 'error', message: "Already in your contacts." });
      } else if (result === 'self') {
        setAddStatus({ kind: 'error', message: "That's you!" });
      } else {
        setAddStatus({ kind: 'error', message: 'No Orbit user with that email.' });
      }
    } catch (err) {
      setAddStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Could not add contact.' });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + 140,
      }}
      showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="displayMedium">Contacts</AppText>
        <IconButton
          name={addingOpen ? 'close' : 'person-add-outline'}
          accessibilityLabel={addingOpen ? 'Cancel' : 'Add contact'}
          onPress={() => {
            setAddingOpen((v) => !v);
            setAddStatus(null);
          }}
        />
      </View>

      {addingOpen && (
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
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
              height: 46,
            }}>
            <TextInput
              value={addEmail}
              onChangeText={setAddEmail}
              placeholder="Add by email"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ flex: 1, color: colors.textPrimary, fontSize: 16 }}
              onSubmitEditing={submitAddContact}
            />
            <PressableScale onPress={submitAddContact} haptic="soft" disabled={!addEmail.trim()}>
              <AppText variant="captionMedium" color="primary">
                Add
              </AppText>
            </PressableScale>
          </View>
          {addStatus?.message && (
            <AppText variant="caption" color={addStatus.kind === 'error' ? 'error' : 'success'}>
              {addStatus.message}
            </AppText>
          )}
        </View>
      )}

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
            {recentConversations.map(({ contact, lastMessage }) => (
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
                <Avatar name={contact.name} uri={contact.avatarUrl} size={40} status={contact.status} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium">{contact.name}</AppText>
                  <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                    {lastMessage.senderId === myUid ? 'You: ' : ''}
                    {lastMessage.text ?? '📷 Photo'}
                  </AppText>
                </View>
                <AppText variant="micro" color="textTertiary">
                  {formatRelativeDay(lastMessage.createdAt)}
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
        {!loading && filtered.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No contacts yet"
            subtitle="Add someone by their email to start meeting and chatting."
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {filtered.map((contact) => (
              <ContactRow key={contact.id} name={contact.name} status={contact.status} onPress={() => router.push(`/contacts/${contact.id}`)} />
            ))}
          </View>
        )}
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
