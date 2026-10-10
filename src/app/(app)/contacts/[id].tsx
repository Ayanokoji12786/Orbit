import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppText, Avatar, Button, IconButton } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { removeContact, setContactFavorite, useContacts } from '@/features/contacts/api';

export default function ContactDetail() {
  const { colors, spacing } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { contacts, loading, error: loadError, retry } = useContacts();
  const contact = contacts.find((c) => c.id === id);
  const [favoritePending, setFavoritePending] = useState(false);
  const [removePending, setRemovePending] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggleFavorite = async () => {
    if (!contact || favoritePending) return;
    setFavoritePending(true);
    setActionError(null);
    const nextFavorite = !contact.isFavorite;
    try {
      await setContactFavorite(contact.id, nextFavorite);
      retry();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update favorite.');
    } finally {
      setFavoritePending(false);
    }
  };

  const confirmRemoval = async () => {
    if (!contact || removePending) return;
    setRemovePending(true);
    setActionError(null);
    try {
      await removeContact(contact.id);
      router.back();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not remove contact.');
      setRemovePending(false);
    }
  };

  if (loading && !contact) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Contact" />
        <AppText variant="body" color={loadError ? 'error' : 'textSecondary'} style={{ textAlign: 'center', marginTop: spacing.xxl }}>
          {loadError ?? 'Contact not found.'}
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={contact.name} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' }}>
        <Avatar name={contact.name} uri={contact.avatarUrl} size={88} status={contact.status} />
        <AppText variant="title" style={{ marginTop: spacing.md }}>
          {contact.name}
        </AppText>
        <AppText variant="caption" color="textSecondary" style={{ textTransform: 'capitalize', marginTop: 2 }}>
          {contact.status}
        </AppText>

        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xl }}>
          <IconButton
            name="videocam"
            variant="filled"
            size={54}
            tone="active"
            accessibilityLabel="Create meeting"
            onPress={() => router.push('/meetings/new')}
          />
          <IconButton
            name="chatbubble"
            variant="filled"
            size={54}
            accessibilityLabel="Message"
            onPress={() => router.push(`/chat/${contact.id}`)}
          />
          <IconButton
            name={contact.isFavorite ? 'star' : 'star-outline'}
            variant="filled"
            size={54}
            accessibilityLabel={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            disabled={favoritePending || removePending}
            onPress={toggleFavorite}
          />
        </View>

        {loadError && (
          <AppText variant="caption" color="error" style={{ textAlign: 'center', marginTop: spacing.md }}>
            Contact details could not be refreshed: {loadError}
          </AppText>
        )}
        {actionError && (
          <AppText variant="caption" color="error" style={{ textAlign: 'center', marginTop: spacing.md }}>
            {actionError}
          </AppText>
        )}

        <View style={{ width: '100%', marginTop: spacing.xxl, gap: spacing.sm }}>
          {confirmRemove ? (
            <>
              <AppText variant="body" style={{ textAlign: 'center' }}>
                Remove {contact.name} from your contacts? Your existing messages will remain.
              </AppText>
              <Button label="Remove contact" variant="destructive" loading={removePending} onPress={confirmRemoval} />
              <Button label="Cancel" variant="ghost" disabled={removePending} onPress={() => setConfirmRemove(false)} />
            </>
          ) : (
            <Button label="Remove from contacts" variant="ghost" onPress={() => setConfirmRemove(true)} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
