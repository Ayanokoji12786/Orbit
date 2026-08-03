import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText, PressableScale } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';

type Props = {
  onInstant: () => void;
  onJoin: () => void;
  onSchedule: () => void;
};

export function QuickActions({ onInstant, onJoin, onSchedule }: Props) {
  const { spacing } = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <QuickAction icon="add-circle" label="New Meeting" onPress={onInstant} emphasized />
      <QuickAction icon="enter-outline" label="Join" onPress={onJoin} />
      <QuickAction icon="calendar-outline" label="Schedule" onPress={onSchedule} />
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  emphasized,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  emphasized?: boolean;
}) {
  const { colors, radii, spacing } = useAppTheme();

  return (
    <PressableScale
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: radii.lg,
        overflow: 'hidden',
        paddingVertical: spacing.md,
        alignItems: 'center',
        gap: 6,
        backgroundColor: emphasized ? undefined : colors.surfaceElevated,
        borderWidth: emphasized ? 0 : 1,
        borderColor: colors.border,
      }}>
      {emphasized && (
        <LinearGradient
          colors={['#5B5FFF', '#7C5CFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      <Ionicons name={icon} size={22} color={emphasized ? colors.textInverse : colors.textPrimary} />
      <AppText variant="captionMedium" color={emphasized ? 'textInverse' : 'textSecondary'}>
        {label}
      </AppText>
    </PressableScale>
  );
}
