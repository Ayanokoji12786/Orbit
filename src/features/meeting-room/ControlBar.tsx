import { useState } from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/ui';

import { ReactionPicker } from './ReactionPicker';

type Props = {
  muted: boolean;
  onToggleMute: () => void;
  cameraOff: boolean;
  onToggleCamera: () => void;
  onReact: (emoji: string) => void;
  onMore: () => void;
  onLeave: () => void;
};

export function ControlBar({ muted, onToggleMute, cameraOff, onToggleCamera, onReact, onMore, onLeave }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={{ alignItems: 'center' }}>
      {pickerOpen && (
        <View style={{ marginBottom: 12 }}>
          <ReactionPicker
            onSelect={(emoji) => {
              onReact(emoji);
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
          accessibilityLabel={muted ? 'Unmute' : 'Mute'}
          onPress={onToggleMute}
        />
        <IconButton
          name={cameraOff ? 'videocam-off' : 'videocam'}
          variant="filled"
          tone={cameraOff ? 'danger' : 'default'}
          accessibilityLabel={cameraOff ? 'Turn camera on' : 'Turn camera off'}
          onPress={onToggleCamera}
        />
        <IconButton
          name="happy-outline"
          variant="filled"
          tone={pickerOpen ? 'active' : 'default'}
          accessibilityLabel="React"
          onPress={() => setPickerOpen((p) => !p)}
        />
        <IconButton name="ellipsis-horizontal" variant="filled" accessibilityLabel="More" onPress={onMore} />
        <IconButton name="call" variant="filled" tone="danger" accessibilityLabel="Leave meeting" onPress={onLeave} />
      </View>
    </View>
  );
}
