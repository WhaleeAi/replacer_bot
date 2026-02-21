"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const shared_1 = require("@vk-text-replacer/shared");
const queue_service_1 = require("./services/queue.service");
const auth_flow_1 = require("./flows/auth.flow");
const addPack_flow_1 = require("./flows/addPack.flow");
const redPosts_flow_1 = require("./flows/redPosts.flow");
const redComments_flow_1 = require("./flows/redComments.flow");
const telegram_service_1 = require("./services/telegram.service");
const state_service_1 = require("./services/state.service");
const dotenv_1 = __importDefault(require("dotenv"));
const node_path_1 = __importDefault(require("node:path"));
const rootEnvPath = node_path_1.default.resolve(__dirname, "../../../.env");
dotenv_1.default.config({ path: rootEnvPath, override: true });
const logger = (0, shared_1.createLogger)("tg-bot");
async function bootstrap() {
    const env = (0, shared_1.getEnv)();
    await (0, shared_1.ensureDatabaseSchema)(env.databaseUrl, logger);
    if (!env.tgBotToken) {
        logger.warn("TG_BOT_TOKEN is empty. Bot will not start.");
        return;
    }
    const bot = new grammy_1.Bot(env.tgBotToken);
    const queueService = (0, queue_service_1.createQueueService)(env.redisUrl, logger);
    const state = (0, state_service_1.createStateService)();
    const vkApi = null;
    (0, telegram_service_1.registerBaseHandlers)(bot, { logger, state });
    (0, auth_flow_1.registerAuthFlow)(bot, {
        databaseUrl: env.databaseUrl,
        logger,
        state
    });
    (0, addPack_flow_1.registerAddPackFlow)(bot, { databaseUrl: env.databaseUrl, logger, state, vkApi });
    (0, redPosts_flow_1.registerRedPostsFlow)(bot, { databaseUrl: env.databaseUrl, queueService, logger, state, vkApi });
    (0, redComments_flow_1.registerRedCommentsFlow)(bot, { databaseUrl: env.databaseUrl, queueService, logger, state, vkApi });
    await bot.start({
        onStart: (botInfo) => logger.info({ username: botInfo.username }, "Telegram bot started")
    });
}
bootstrap().catch((error) => {
    logger.error({ err: error }, "Failed to start tg-bot");
    process.exit(1);
});
//# sourceMappingURL=index.js.map