export interface RateLimitService {
  wait(): Promise<void>;
}

export function createRateLimitService(rps: number): RateLimitService {
  const intervalMs = Math.max(1, Math.floor(1000 / Math.max(1, rps)));
  let nextAllowedTs = Date.now();

  return {
    async wait(): Promise<void> {
      const now = Date.now();
      const waitMs = Math.max(0, nextAllowedTs - now);
      nextAllowedTs = Math.max(nextAllowedTs, now) + intervalMs;
      if (waitMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
    }
  };
}
