"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnv = getEnv;
function parseNumber(input, fallback) {
    const value = Number(input);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}
function parseVkTokens(json) {
    if (!json) {
        return {};
    }
    try {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        return Object.entries(parsed).reduce((acc, [groupId, token]) => {
            if (typeof token === "string" && token.trim()) {
                acc[groupId] = token;
            }
            return acc;
        }, {});
    }
    catch {
        return {};
    }
}
function getEnv() {
    return {
        tgBotToken: process.env.TG_BOT_TOKEN ?? "",
        adminKey: process.env.ADMIN_KEY ?? "",
        databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/replacer_bot",
        redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
        vkTokens: parseVkTokens(process.env.VK_TOKENS_JSON),
        vkApiVersion: process.env.VK_API_VERSION ?? "5.131",
        workerConcurrency: parseNumber(process.env.WORKER_CONCURRENCY, 3),
        vkRps: parseNumber(process.env.VK_RPS, 3)
    };
}
//# sourceMappingURL=env.js.map