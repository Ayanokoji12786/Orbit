export function formatCountdown(isoDate: string): string {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) return 'Starting now';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `Starts in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `Starts in ${hours}h`;
}

export function formatClockTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatRelativeDay(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const hours = Math.round(diffMs / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
