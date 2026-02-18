import type { AppEnv } from "./types";

function parseNumber(input: string | undefined, fallback: number): number {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseVkTokens(json: string | undefined): Record<string, string> {
  if (!json) {
    return {};
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [groupId, token]) => {
      if (typeof token === "string" && token.trim()) {
        acc[groupId] = token;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function getEnv(): AppEnv {
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
