import type { Contact, Meeting, RecordingSummary } from '@/types/domain';

export const mockContacts: Contact[] = [
  { id: '1', name: 'Priya Sharma', status: 'online', isFavorite: true },
  { id: '2', name: 'Marcus Lee', status: 'online', isFavorite: true },
  { id: '3', name: 'Ava Torres', status: 'away', isFavorite: true },
  { id: '4', name: 'Noah Kim', status: 'offline', isFavorite: true },
];

export const mockUpcomingMeeting: Meeting = {
  id: 'm1',
  title: 'Design Review — Orbit v1',
  startsAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
  durationMinutes: 30,
  participants: [
    { id: '1', name: 'Priya Sharma' },
    { id: '2', name: 'Marcus Lee' },
    { id: '3', name: 'Ava Torres' },
  ],
  hasPassword: false,
};

export const mockRecentMeetings: Meeting[] = [
  {
    id: 'm2',
    title: 'Weekly Sync',
    startsAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 26,
    participants: [
      { id: '2', name: 'Marcus Lee' },
      { id: '4', name: 'Noah Kim' },
    ],
    hasPassword: false,
  },
  {
    id: 'm3',
    title: '1:1 with Ava',
    startsAt: new Date(Date.now() - 44 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 18,
    participants: [{ id: '3', name: 'Ava Torres' }],
    hasPassword: false,
  },
];

export const mockRecordingSummary: RecordingSummary = {
  meetingId: 'm2',
  meetingTitle: 'Weekly Sync',
  createdAt: mockRecentMeetings[0].startsAt,
  highlight:
    'Team agreed to ship the AI captions beta by Friday. Marcus will own the Deepgram integration; Noah follows up on pricing.',
};
