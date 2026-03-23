export function computeMinuteRampPollIntervalMs(
  elapsedMs: number,
  params: {
    minIntervalMs: number;
    maxIntervalMs: number;
  }
): number {
  // Increase interval by 1 second every minute: 1s, 2s, 3s... capped.
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const intervalSeconds = 1 + Math.floor(elapsedSeconds / 60);
  const intervalMs = intervalSeconds * 1000;

  return Math.min(params.maxIntervalMs, Math.max(params.minIntervalMs, intervalMs));
}
