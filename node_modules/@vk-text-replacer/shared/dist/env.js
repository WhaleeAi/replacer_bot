"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnv = getEnv;
function parseNumber(input, fallback) {
    const value = Number(input);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}
function getEnv() {
    return {
        tgBotToken: process.env.TG_BOT_TOKEN ?? "",
        databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/replacer_bot",
        redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
        vkApiVersion: process.env.VK_API_VERSION ?? "5.131",
        workerConcurrency: parseNumber(process.env.WORKER_CONCURRENCY, 3),
        vkRps: parseNumber(process.env.VK_RPS, 3)
    };
}
//# sourceMappingURL=env.js.map