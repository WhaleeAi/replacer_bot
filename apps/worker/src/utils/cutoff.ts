export function getCutoffUnixTimestamp(cutoffDays: number): number {
  const nowMs = Date.now();
  const daysMs = Math.max(0, cutoffDays) * 24 * 60 * 60 * 1000;
  return Math.floor((nowMs - daysMs) / 1000);
}
