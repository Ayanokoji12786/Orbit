import { forwardRef } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';

type Props = PressableProps & {
  isFocused?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export const CustomTabButton = forwardRef<View, Props>(function CustomTabButton(
  { isFocused, icon, label, onPress, ...rest },
  ref,
) {
  const { colors, radii } = useAppTheme();

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      onPress={(e) => {
        if (!isFocused) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: radii.lg,
        backgroundColor: isFocused ? colors.primaryMuted : 'transparent',
      }}
      {...rest}>
      <Ionicons name={icon} size={22} color={isFocused ? colors.primary : colors.textTertiary} />
      {isFocused && (
        <AppText variant="micro" color="primary" style={{ marginTop: 2 }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
});
