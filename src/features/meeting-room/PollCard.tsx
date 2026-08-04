import { View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import type { Poll } from '@/types/domain';

type Props = {
  poll: Poll;
  onVote: (optionId: string) => void;
};

export function PollCard({ poll, onVote }: Props) {
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
  const hasVoted = poll.votedOptionId !== null;

  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
      }}>
      <AppText variant="bodyMedium" color="textInverse">
        {poll.question}
      </AppText>
      <View style={{ marginTop: 10, gap: 8 }}>
        {poll.options.map((option) => {
          const percent = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const isChoice = poll.votedOptionId === option.id;

          return (
            <PressableScale
              key={option.id}
              onPress={() => !hasVoted && onVote(option.id)}
              disabled={hasVoted}
              haptic="soft">
              <View
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: isChoice ? 1.5 : 0,
                  borderColor: '#5B5FFF',
                }}>
                {hasVoted && (
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${percent}%`,
                      backgroundColor: 'rgba(91,95,255,0.35)',
                    }}
                  />
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}>
                  <AppText variant="body" color="textInverse">
                    {option.label}
                  </AppText>
                  {hasVoted && (
                    <AppText variant="captionMedium" color="textInverse">
                      {percent}%
                    </AppText>
                  )}
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>
      <AppText variant="micro" color="textTertiary" style={{ marginTop: 8 }}>
        {totalVotes} vote{totalVotes === 1 ? '' : 's'}
      </AppText>
    </View>
  );
}
