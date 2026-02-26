export function formatRemaining(resetsAt: string | null | undefined): string {
  if (!resetsAt) return '--';
  const resetEpoch = Date.parse(resetsAt);
  if (isNaN(resetEpoch)) return '--';
  const diff = Math.floor((resetEpoch - Date.now()) / 1000);
  if (diff <= 0) return 'now';
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m`;
  return '<1m';
}
