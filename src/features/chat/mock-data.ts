import type { ChatMessage } from '@/types/domain';

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

export const seedDmMessages: Record<string, ChatMessage[]> = {
  '1': [
    { id: 's1', senderId: '1', senderName: 'Priya Sharma', text: 'Hey! Are we still on for the design review?', createdAt: hoursAgo(21) },
    { id: 's2', senderId: 'me', senderName: 'You', text: 'Yep, 45 minutes from now 👍', createdAt: hoursAgo(20.9) },
    { id: 's3', senderId: '1', senderName: 'Priya Sharma', text: "I'll bring the updated onboarding mocks.", createdAt: hoursAgo(20.8) },
  ],
  '2': [
    { id: 's4', senderId: '2', senderName: 'Marcus Lee', text: 'Pushed the Deepgram integration branch.', createdAt: hoursAgo(19) },
    { id: 's5', senderId: 'me', senderName: 'You', text: 'On it, reviewing now.', createdAt: hoursAgo(18.7) },
  ],
};
