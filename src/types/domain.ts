export type Contact = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  status: 'online' | 'away' | 'offline';
  isFavorite: boolean;
};

export type MeetingParticipant = Pick<Contact, 'id' | 'name' | 'avatarUrl'>;

export type Meeting = {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  participants: MeetingParticipant[];
  hasPassword: boolean;
};

export type RecordingSummary = {
  meetingId: string;
  meetingTitle: string;
  createdAt: string;
  highlight: string;
};
