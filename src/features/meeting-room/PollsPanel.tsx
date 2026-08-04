import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { AppText, BottomSheet, Button, EmptyState, IconButton } from '@/components/ui';

import { PollCard } from './PollCard';
import { useMeetingPolls } from './polls-api';

type Props = {
  visible: boolean;
  onClose: () => void;
  meetingId: string;
};

export function PollsPanel({ visible, onClose, meetingId }: Props) {
  const { polls, createPoll, vote } = useMeetingPolls(meetingId);
  const [creating, setCreating] = useState(false);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightPercent={0.6}
      surfaceColor="#161618"
      handleColor="rgba(255,255,255,0.2)">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}>
        <AppText variant="headline" color="textInverse">
          {creating ? 'New poll' : 'Polls'}
        </AppText>
        {!creating && <IconButton name="add" variant="filled" accessibilityLabel="Create poll" onPress={() => setCreating(true)} />}
      </View>

      {creating ? (
        <CreatePollForm
          onCancel={() => setCreating(false)}
          onCreate={async (question, options) => {
            await createPoll(question, options);
            setCreating(false);
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          {polls.length === 0 ? (
            <EmptyState icon="stats-chart-outline" title="No polls yet" subtitle="Create one to get a quick read from the room." />
          ) : (
            polls.map((poll) => <PollCard key={poll.id} poll={poll} onVote={(optionId) => vote(poll.id, optionId)} />)
          )}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

function CreatePollForm({
  onCreate,
  onCancel,
}: {
  onCreate: (question: string, options: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);

  const updateOption = (index: number, value: string) => {
    setOptions((current) => current.map((o, i) => (i === index ? value : o)));
  };

  const canCreate = question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  const submit = async () => {
    setSubmitting(true);
    try {
      await onCreate(question.trim(), options.map((o) => o.trim()).filter(Boolean));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <TextInput
        value={question}
        onChangeText={setQuestion}
        placeholder="Ask a question"
        placeholderTextColor="rgba(255,255,255,0.4)"
        style={inputStyle}
      />
      {options.map((option, i) => (
        <TextInput
          key={i}
          value={option}
          onChangeText={(v) => updateOption(i, v)}
          placeholder={`Option ${i + 1}`}
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={inputStyle}
        />
      ))}
      {options.length < 4 && (
        <Button label="Add option" variant="ghost" onPress={() => setOptions((c) => [...c, ''])} />
      )}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Create" disabled={!canCreate} loading={submitting} onPress={submit} />
        </View>
      </View>
    </View>
  );
}

const inputStyle = {
  height: 48,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.14)',
  backgroundColor: 'rgba(255,255,255,0.06)',
  paddingHorizontal: 14,
  color: '#F5F5F7',
  fontSize: 16,
};
