import { useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';

const LENGTH = 6;

type Props = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

export function OtpInput({ value, onChange, autoFocus }: Props) {
  const { colors, radii } = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
        {digits.map((digit, i) => {
          const isActive = value.length === i;
          return (
            <View
              key={i}
              style={{
                width: 46,
                height: 56,
                borderRadius: radii.md,
                borderWidth: isActive ? 2 : 1,
                borderColor: isActive ? colors.primary : colors.border,
                backgroundColor: colors.surfaceElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <AppText variant="title">{digit}</AppText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, LENGTH))}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        maxLength={LENGTH}
        textContentType="oneTimeCode"
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
    </Pressable>
  );
}
