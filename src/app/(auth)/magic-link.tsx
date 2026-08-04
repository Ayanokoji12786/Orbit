import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, GradientBackground, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { sendSignInCode, verifySignInCode } from '@/features/auth/api';

export default function MagicLinkWait() {
  const { spacing, radii, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(30);

  const verify = async () => {
    setError(null);
    setVerifying(true);
    try {
      await verifySignInCode(email, code.trim());
      // Auth state listener picks up the new session; the root gate redirects automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code is invalid or has expired.');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setCooldown(30);
    setResending(true);
    try {
      await sendSignInCode(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
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
          We sent a 6-digit code to{'\n'}
          <AppText variant="bodyMedium">{email}</AppText>.
        </AppText>

        <View style={{ marginTop: spacing.xxl }}>
          <AppText variant="captionMedium" color="textSecondary">
            ENTER CODE
          </AppText>
          <TextInput
            value={code}
            onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="123456"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={6}
            style={{
              height: 52,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceElevated,
              paddingHorizontal: spacing.base,
              marginTop: spacing.xs,
              color: colors.textPrimary,
              fontSize: 20,
              letterSpacing: 4,
            }}
          />
        </View>

        {error && (
          <AppText variant="caption" color="error" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
            {error}
          </AppText>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Button label="Continue" onPress={verify} loading={verifying} disabled={code.length !== 6} />
        </View>

        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <Button
            label={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
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
