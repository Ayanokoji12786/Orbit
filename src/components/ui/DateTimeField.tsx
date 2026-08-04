import { Platform, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { useAppTheme } from '@/design-system/useAppTheme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Props = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
};

export function DateTimeField({ label, value, onChange, minimumDate }: Props) {
  const { colors, radii, spacing, isDark } = useAppTheme();

  const fieldStyle = {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
  };

  if (Platform.OS === 'android') {
    const openPickers = () => {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        minimumDate,
        onChange: (event, selectedDate) => {
          if (event.type !== 'set' || !selectedDate) return;
          DateTimePickerAndroid.open({
            value: selectedDate,
            mode: 'time',
            onChange: (timeEvent, selectedTime) => {
              if (timeEvent.type !== 'set' || !selectedTime) return;
              onChange(selectedTime);
            },
          });
        },
      });
    };

    return (
      <PressableScale onPress={openPickers} haptic="soft">
        <View style={fieldStyle}>
          <AppText variant="captionMedium" color="textSecondary">
            {label}
          </AppText>
          <AppText variant="body" style={{ marginTop: 2 }}>
            {value.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </AppText>
        </View>
      </PressableScale>
    );
  }

  return (
    <View style={[fieldStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
      <AppText variant="captionMedium" color="textSecondary">
        {label}
      </AppText>
      <DateTimePicker
        value={value}
        mode="datetime"
        display="compact"
        minimumDate={minimumDate}
        themeVariant={isDark ? 'dark' : 'light'}
        onChange={(_, selectedDate) => selectedDate && onChange(selectedDate)}
      />
    </View>
  );
}
