import { Bot } from "grammy";
import { createLogger, ensureDatabaseSchema, getEnv } from "@vk-text-replacer/shared";
import { createQueueService } from "./services/queue.service";
import { registerAuthFlow } from "./flows/auth.flow";
import { registerAddPackFlow } from "./flows/addPack.flow";
import { registerRedPostsFlow } from "./flows/redPosts.flow";
import { registerRedCommentsFlow } from "./flows/redComments.flow";
import { registerBaseHandlers } from "./services/telegram.service";
import { createStateService } from "./services/state.service";
import dotenv from "dotenv";
import path from "node:path";

const rootEnvPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: rootEnvPath, override: true });

const logger = createLogger("tg-bot");

async function bootstrap(): Promise<void> {
  const env = getEnv();
  await ensureDatabaseSchema(env.databaseUrl, logger);

  if (!env.tgBotToken) {
    logger.warn("TG_BOT_TOKEN is empty. Bot will not start.");
    return;
  }

  const bot = new Bot(env.tgBotToken);
  const queueService = createQueueService(env.redisUrl, logger);
  const state = createStateService();
  const vkApi = null;

  registerBaseHandlers(bot, { databaseUrl: env.databaseUrl, logger, state });
  registerAuthFlow(bot, {
    databaseUrl: env.databaseUrl,
    logger,
    state
  });
  registerAddPackFlow(bot, { databaseUrl: env.databaseUrl, logger, state, vkApi });
  registerRedPostsFlow(bot, { databaseUrl: env.databaseUrl, queueService, logger, state, vkApi });
  registerRedCommentsFlow(bot, { databaseUrl: env.databaseUrl, queueService, logger, state, vkApi });

  await bot.start({
    onStart: (botInfo) => logger.info({ username: botInfo.username }, "Telegram bot started")
  });
}

bootstrap().catch((error: unknown) => {
  logger.error({ err: error }, "Failed to start tg-bot");
  process.exit(1);
});
