import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, PressableScale } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { type ThemeMode, useThemeStore } from '@/stores/theme-store';

const options: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'system', label: 'Match system', icon: 'phone-portrait-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon' },
  { mode: 'light', label: 'Light', icon: 'sunny' },
];

export default function Appearance() {
  const { colors, spacing, radii } = useAppTheme();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Appearance" />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {options.map((option) => {
          const active = mode === option.mode;
          return (
            <PressableScale key={option.mode} onPress={() => setMode(option.mode)} haptic="soft">
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: active ? 1.5 : 0,
                  borderColor: colors.primary,
                }}>
                <Ionicons name={option.icon} size={20} color={active ? colors.primary : colors.textPrimary} />
                <AppText variant="body" color={active ? 'primary' : 'textPrimary'} style={{ flex: 1 }}>
                  {option.label}
                </AppText>
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
