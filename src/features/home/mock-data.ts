import type { RecordingSummary } from '@/types/domain';

// AI summaries stay mocked until Phase 4 wires a real summarization pipeline.
export const mockRecordingSummary: RecordingSummary = {
  meetingId: 'weekly-sync',
  meetingTitle: 'Weekly Sync',
  createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  highlight:
    'Team agreed to ship the AI captions beta by Friday. Marcus will own the Deepgram integration; Noah follows up on pricing.',
};
