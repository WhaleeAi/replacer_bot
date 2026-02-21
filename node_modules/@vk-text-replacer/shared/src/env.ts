import type { AppEnv } from "./types";

function parseNumber(input: string | undefined, fallback: number): number {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseOptionalNumber(input: string | undefined): number {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function getEnv(): AppEnv {
  return {
    tgBotToken: process.env.TG_BOT_TOKEN ?? "",
    adminTgUserId: parseOptionalNumber(process.env.ADMIN_TG_USER_ID),
    databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/replacer_bot",
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    vkApiVersion: process.env.VK_API_VERSION ?? "5.131",
    workerConcurrency: parseNumber(process.env.WORKER_CONCURRENCY, 3),
    vkRps: parseNumber(process.env.VK_RPS, 3)
  };
}
