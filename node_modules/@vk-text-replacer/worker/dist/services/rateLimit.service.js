"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimitService = createRateLimitService;
function createRateLimitService(rps) {
    const intervalMs = Math.max(1, Math.floor(1000 / Math.max(1, rps)));
    let nextAllowedTs = Date.now();
    return {
        async wait() {
            const now = Date.now();
            const waitMs = Math.max(0, nextAllowedTs - now);
            nextAllowedTs = Math.max(nextAllowedTs, now) + intervalMs;
            if (waitMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }
    };
}
//# sourceMappingURL=rateLimit.service.js.map