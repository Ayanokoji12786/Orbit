import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, GradientBackground, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { sendEmailOtp, verifyEmailOtp } from '@/features/auth/api';
import { OtpInput } from '@/features/auth/OtpInput';

export default function VerifyOtp() {
  const { spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (code.length === 6) verify();
  }, [code]);

  const verify = async () => {
    setError(null);
    setVerifying(true);
    try {
      await verifyEmailOtp(email, code);
      // Auth state listener will pick up the new session and the root
      // gate will redirect into the app automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Try again.');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setCooldown(30);
    try {
      await sendEmailOtp(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code.');
    }
  };

  return (
    <GradientBackground>
      <View style={{ flex: 1, paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl }}>
        <IconButton
          name="chevron-back"
          variant="glass"
          accessibilityLabel="Back"
          onPress={() => router.back()}
        />

        <AppText variant="displayMedium" style={{ marginTop: spacing.xl }}>
          Check your email
        </AppText>
        <AppText variant="body" color="textSecondary" style={{ marginTop: spacing.xs }}>
          Enter the 6-digit code we sent to{'\n'}
          <AppText variant="bodyMedium">{email}</AppText>
        </AppText>

        <View style={{ marginTop: spacing.xxl }}>
          <OtpInput value={code} onChange={setCode} autoFocus />
        </View>

        {error && (
          <AppText variant="caption" color="error" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
            {error}
          </AppText>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <Button label="Verify" onPress={verify} loading={verifying} disabled={code.length < 6} />
        </View>

        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <Button
            label={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            variant="ghost"
            fullWidth={false}
            disabled={cooldown > 0}
            onPress={resend}
          />
        </View>
      </View>
    </GradientBackground>
  );
}
