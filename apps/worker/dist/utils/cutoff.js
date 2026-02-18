"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCutoffUnixTimestamp = getCutoffUnixTimestamp;
function getCutoffUnixTimestamp(cutoffDays) {
    const nowMs = Date.now();
    const daysMs = Math.max(0, cutoffDays) * 24 * 60 * 60 * 1000;
    return Math.floor((nowMs - daysMs) / 1000);
}
//# sourceMappingURL=cutoff.js.map