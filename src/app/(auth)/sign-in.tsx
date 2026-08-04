import { useCallback, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Divider, GradientBackground, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { sendSignInCode, signInWithApple } from '@/features/auth/api';
import { useGoogleSignIn } from '@/features/auth/useGoogleSignIn';

export default function SignIn() {
  const { colors, spacing, radii, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAuthError = useCallback((err: Error) => setError(err.message), []);
  const google = useGoogleSignIn(onAuthError);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const continueWithEmail = async () => {
    setError(null);
    setSending(true);
    try {
      await sendSignInCode(email);
      router.push({ pathname: '/(auth)/magic-link', params: { email } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSending(false);
    }
  };

  const continueWithApple = async () => {
    setError(null);
    try {
      await signInWithApple();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apple sign-in failed.');
    }
  };

  return (
    <GradientBackground>
      <View style={{ flex: 1, paddingTop: insets.top + spacing.xxl, paddingHorizontal: spacing.xl }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radii.lg,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppText variant="displayMedium" color="textInverse">
            O
          </AppText>
        </View>

        <AppText variant="displayMedium" style={{ marginTop: spacing.lg }}>
          Welcome to Orbit
        </AppText>
        <AppText variant="body" color="textSecondary" style={{ marginTop: spacing.xs }}>
          Sign in to start meeting, chatting, and collaborating.
        </AppText>

        <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                isDark
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={radii.md}
              style={{ height: 56, width: '100%' }}
              onPress={continueWithApple}
            />
          )}

          <Button
            label="Continue with Google"
            variant="secondary"
            onPress={() => google.promptAsync()}
            disabled={!google.isAvailable}
            loading={google.loading}
            icon={<IconGlyph letter="G" />}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl }}>
          <View style={{ flex: 1 }}>
            <Divider />
          </View>
          <AppText variant="caption" color="textTertiary">
            or
          </AppText>
          <View style={{ flex: 1 }}>
            <Divider />
          </View>
        </View>

        <AppText variant="captionMedium" color="textSecondary">
          EMAIL
        </AppText>
        <TextInput
          value={email}
          onChangeText={setEmail}
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

        {error && (
          <AppText variant="caption" color="error" style={{ marginTop: spacing.sm }}>
            {error}
          </AppText>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Button
            label="Email me a code"
            onPress={continueWithEmail}
            disabled={!emailValid}
            loading={sending}
          />
        </View>

        <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.xl, textAlign: 'center' }}>
          By continuing, you agree to Orbit's Terms of Service and Privacy Policy.
        </AppText>
      </View>
    </GradientBackground>
  );
}

function IconGlyph({ letter }: { letter: string }) {
  return (
    <AppText variant="headline" color="primary">
      {letter}
    </AppText>
  );
}
