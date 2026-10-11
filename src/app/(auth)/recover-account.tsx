import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, GradientBackground, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { sendRecoveryCode, verifyRecoveryCode } from '@/features/auth/api';

const REQUEST_INTERVAL_SECONDS = 60;

export default function RecoverAccount() {
  const { spacing, radii, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [requested, setRequested] = useState(false);
  const [enteringCode, setEnteringCode] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const normalizedEmail = email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestCode = async () => {
    if (!emailValid || requesting) return;
    setError(null);
    setRequesting(true);
    try {
      await sendRecoveryCode(normalizedEmail);
      setRequested(true);
      setCooldown(REQUEST_INTERVAL_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request a code. Try again later.');
    } finally {
      setRequesting(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6 || verifying) return;
    setError(null);
    setVerifying(true);
    try {
      await verifyRecoveryCode(normalizedEmail, code);
      // The auth layout moves to the app after Supabase publishes the new session.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify this code.');
    } finally {
      setVerifying(false);
    }
  };

  const resetEmail = () => {
    setRequested(false);
    setEnteringCode(false);
    setCode('');
    setError(null);
    setCooldown(0);
  };

  return (
    <GradientBackground>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
        }}>
        <IconButton
          name="chevron-back"
          variant="glass"
          accessibilityLabel="Back to sign-in"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/sign-in')}
        />

        <AppText variant="displayMedium" style={{ marginTop: spacing.xl }}>
          Recover your account
        </AppText>
        <AppText variant="body" color="textSecondary" style={{ marginTop: spacing.sm }}>
          Signed out or switched devices? If you previously used an email code, enter that same address to sign in again. This will not create a new account.
        </AppText>

        {!requested ? (
          <View style={{ marginTop: spacing.xxl }}>
            <AppText variant="captionMedium" color="textSecondary">ACCOUNT EMAIL</AppText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              accessibilityLabel="Account email address"
              placeholder="you@example.com"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
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
            <View style={{ marginTop: spacing.lg }}>
              <Button label="Request a sign-in code" onPress={requestCode} disabled={!emailValid} loading={requesting} />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
            <AppText variant="body" color="textSecondary" accessibilityLiveRegion="polite">
              If an existing Orbit account can receive email codes at {normalizedEmail}, check that inbox. Delivery may take a few minutes.
            </AppText>

            {enteringCode ? (
              <View>
                <AppText variant="captionMedium" color="textSecondary">SIX-DIGIT CODE</AppText>
                <TextInput
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                  accessibilityLabel="Six-digit sign-in code"
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
                <View style={{ marginTop: spacing.lg }}>
                  <Button label="Sign in with code" onPress={verifyCode} disabled={code.length !== 6} loading={verifying} />
                </View>
              </View>
            ) : (
              <Button label="I have a code" onPress={() => setEnteringCode(true)} />
            )}

            <Button
              label={cooldown > 0 ? `Request another code in ${cooldown}s` : 'Request another code'}
              variant="ghost"
              onPress={requestCode}
              disabled={cooldown > 0}
              loading={requesting}
            />
            <Button label="Use another email" variant="ghost" onPress={resetEmail} />
          </View>
        )}

        {error && (
          <AppText variant="caption" color="error" accessibilityLiveRegion="polite" style={{ marginTop: spacing.lg }}>
            {error}
          </AppText>
        )}

        <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.xxl }}>
          Used Apple or Google instead? Return to sign-in and use that provider. Apple Hide My Email can use a different address. If you no longer control your sign-in method, Orbit cannot verify account ownership here.
        </AppText>
      </ScrollView>
    </GradientBackground>
  );
}
