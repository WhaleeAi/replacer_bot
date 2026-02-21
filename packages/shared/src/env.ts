import type { AppEnv } from "./types";

function parseNumber(input: string | undefined, fallback: number): number {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getEnv(): AppEnv {
  return {
    tgBotToken: process.env.TG_BOT_TOKEN ?? "",
    databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/replacer_bot",
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    vkApiVersion: process.env.VK_API_VERSION ?? "5.131",
    workerConcurrency: parseNumber(process.env.WORKER_CONCURRENCY, 3),
    vkRps: parseNumber(process.env.VK_RPS, 3)
  };
}
