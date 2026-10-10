import { useState } from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/ui';

import { ReactionPicker } from './ReactionPicker';

type Props = {
  muted: boolean;
  onToggleMute?: () => void;
  cameraOff: boolean;
  onToggleCamera?: () => void;
  onReact?: (emoji: string) => void;
  onMore: () => void;
  onLeave: () => void;
  previewOnly?: boolean;
};

export function ControlBar({ muted, onToggleMute, cameraOff, onToggleCamera, onReact, onMore, onLeave, previewOnly = false }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={{ alignItems: 'center' }}>
      {pickerOpen && (
        <View style={{ marginBottom: 12 }}>
          <ReactionPicker
            onSelect={(emoji) => {
              onReact?.(emoji);
              setPickerOpen(false);
            }}
          />
        </View>
      )}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          width: '100%',
          padding: 12,
          borderRadius: 28,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
        }}>
        <IconButton
          name={muted ? 'mic-off' : 'mic'}
          variant="filled"
          tone={muted ? 'danger' : 'default'}
          accessibilityLabel={previewOnly ? 'Microphone unavailable in web preview' : muted ? 'Unmute' : 'Mute'}
          disabled={previewOnly}
          onPress={onToggleMute}
        />
        <IconButton
          name={cameraOff ? 'videocam-off' : 'videocam'}
          variant="filled"
          tone={cameraOff ? 'danger' : 'default'}
          accessibilityLabel={previewOnly ? 'Camera unavailable in web preview' : cameraOff ? 'Turn camera on' : 'Turn camera off'}
          disabled={previewOnly}
          onPress={onToggleCamera}
        />
        <IconButton
          name="happy-outline"
          variant="filled"
          tone={pickerOpen ? 'active' : 'default'}
          accessibilityLabel={previewOnly ? 'Reactions unavailable in web preview' : 'React'}
          disabled={previewOnly}
          onPress={() => setPickerOpen((p) => !p)}
        />
        <IconButton name="ellipsis-horizontal" variant="filled" accessibilityLabel="More" onPress={onMore} />
        <IconButton name="call" variant="filled" tone="danger" accessibilityLabel="Leave meeting" onPress={onLeave} />
      </View>
    </View>
  );
}
