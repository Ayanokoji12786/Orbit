import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/design-system/useAppTheme';

import { AppText } from './AppText';

type Status = 'online' | 'away' | 'offline' | 'none';

type Props = {
  uri?: string | null;
  name: string;
  size?: number;
  status?: Status;
};

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Avatar({ uri, name, size = 44, status = 'none' }: Props) {
  const { colors } = useAppTheme();
  const statusColor =
    status === 'online' ? colors.success : status === 'away' ? colors.warning : colors.textTertiary;

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={['#5B5FFF', '#7C5CFC']}
          style={[styles.initialsWrap, { width: size, height: size, borderRadius: size / 2 }]}>
          <AppText variant="bodyMedium" color="textInverse" style={{ fontSize: size * 0.38 }}>
            {initialsFor(name)}
          </AppText>
        </LinearGradient>
      )}
      {status !== 'none' && (
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: statusColor,
              borderColor: colors.background,
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initialsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
});
