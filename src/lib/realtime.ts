/**
 * Supabase keys realtime channels by name: `client.channel(name)` returns the *existing*
 * instance when that name is already in use, rather than creating a second one. Two hooks
 * sharing a name therefore share one subscription — the second `.on()` binding never
 * receives events (and throws outright if the first has already finished subscribing), and
 * whichever unmounts first calls `removeChannel` and kills realtime for the other.
 *
 * Several hooks in this app legitimately watch the same row set from different screens that
 * are mounted at once (Expo Router keeps tabs and pushed-under screens alive), so names must
 * be unique per subscription. The server-side scoping comes from the `filter` option, not the
 * channel name, so a per-instance suffix costs nothing.
 */
let channelSeq = 0;

export function uniqueChannel(base: string): string {
  channelSeq += 1;
  return `${base}:${channelSeq}`;
}
