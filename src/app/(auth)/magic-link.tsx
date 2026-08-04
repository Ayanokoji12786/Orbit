import { useEffect, useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, GradientBackground, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { completeSignInWithLink, isSignInLink, sendSignInLink } from '@/features/auth/api';

export default function MagicLinkWait() {
  const { spacing, radii, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [pastedLink, setPastedLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(30);

  const complete = async (link: string) => {
    if (!isSignInLink(link)) {
      setError("That doesn't look like the sign-in link from your email.");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      await completeSignInWithLink(email, link);
      // Auth state listener picks up the new session; the root gate redirects automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That link is invalid or has expired.');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url && isSignInLink(url)) complete(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isSignInLink(url)) complete(url);
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setCooldown(30);
    setResending(true);
    try {
      await sendSignInLink(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the link.');
    } finally {
      setResending(false);
    }
  };

  return (
    <GradientBackground>
      <View style={{ flex: 1, paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl }}>
        <IconButton name="chevron-back" variant="glass" accessibilityLabel="Back" onPress={() => router.back()} />

        <AppText variant="displayMedium" style={{ marginTop: spacing.xl }}>
          Check your email
        </AppText>
        <AppText variant="body" color="textSecondary" style={{ marginTop: spacing.xs }}>
          We sent a sign-in link to{'\n'}
          <AppText variant="bodyMedium">{email}</AppText>. Open it on this device to continue.
        </AppText>

        <View style={{ marginTop: spacing.xxl }}>
          <AppText variant="captionMedium" color="textSecondary">
            OPENED THE LINK SOMEWHERE ELSE? PASTE IT HERE
          </AppText>
          <TextInput
            value={pastedLink}
            onChangeText={setPastedLink}
            placeholder="https://…"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              height: 52,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceElevated,
              paddingHorizontal: spacing.base,
              marginTop: spacing.xs,
              color: colors.textPrimary,
              fontSize: 16,
            }}
          />
        </View>

        {error && (
          <AppText variant="caption" color="error" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
            {error}
          </AppText>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Button label="Continue" onPress={() => complete(pastedLink.trim())} loading={verifying} disabled={!pastedLink.trim()} />
        </View>

        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <Button
            label={cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend link'}
            variant="ghost"
            fullWidth={false}
            disabled={cooldown > 0}
            loading={resending}
            onPress={resend}
          />
        </View>
      </View>
    </GradientBackground>
  );
}
