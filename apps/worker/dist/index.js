"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const shared_1 = require("@vk-text-replacer/shared");
const processGroup_job_1 = require("./jobs/processGroup.job");
const vk_service_1 = require("./services/vk.service");
const rateLimit_service_1 = require("./services/rateLimit.service");
const replace_service_1 = require("./services/replace.service");
const telegram_service_1 = require("./services/telegram.service");
const dotenv_1 = __importDefault(require("dotenv"));
const node_path_1 = __importDefault(require("node:path"));
const logger = (0, shared_1.createLogger)("worker");
const rootEnvPath = node_path_1.default.resolve(__dirname, "../../../.env");
dotenv_1.default.config({ path: rootEnvPath, override: true });
function createRedisConnection(redisUrl) {
    const parsed = new URL(redisUrl);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
        throw new Error(`Unsupported REDIS_URL protocol: ${parsed.protocol}`);
    }
    const dbRaw = parsed.pathname.replace("/", "");
    const db = dbRaw ? Number(dbRaw) : undefined;
    return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 6379,
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        db: Number.isFinite(db) ? db : undefined,
        tls: parsed.protocol === "rediss:" ? {} : undefined,
        maxRetriesPerRequest: null
    };
}
async function bootstrap() {
    const env = (0, shared_1.getEnv)();
    await (0, shared_1.ensureDatabaseSchema)(env.databaseUrl, logger);
    const connection = createRedisConnection(env.redisUrl);
    const rateLimitService = (0, rateLimit_service_1.createRateLimitService)(env.vkRps);
    const vkService = (0, vk_service_1.createVkService)({
        apiVersion: env.vkApiVersion,
        logger,
        rateLimitService
    });
    const replaceService = (0, replace_service_1.createReplaceService)();
    const taskStats = new Map();
    function normalizeTotalGroups(value) {
        return Number.isFinite(value) && (value ?? 0) > 0 ? value : 1;
    }
    async function flushTaskSummary(taskId) {
        const stats = taskStats.get(taskId);
        if (!stats || stats.processedGroups < stats.totalGroups) {
            return;
        }
        taskStats.delete(taskId);
        const text = [
            `taskId: ${taskId}`,
            `groupsTotal: ${stats.totalGroups}`,
            `groupsProcessed: ${stats.processedGroups}`,
            `checkedPosts: ${stats.checkedPosts}`,
            `editedPosts: ${stats.editedPosts}`,
            `skippedPosts: ${stats.skippedPosts}`,
            `errorsCount: ${stats.errorsCount}`,
            `failedGroups: ${stats.failedGroups}`
        ].join("\n");
        try {
            await (0, telegram_service_1.sendMessage)(stats.requestedBy, text);
        }
        catch (error) {
            logger.warn({ err: error, taskId }, "Failed to send final task summary");
        }
    }
    const worker = new bullmq_1.Worker(shared_1.QUEUE_NAMES.VK_RED_POSTS, async (job) => {
        return (0, processGroup_job_1.processGroupJob)(job, {
            logger,
            vkService,
            replaceService
        });
    }, {
        connection,
        concurrency: env.workerConcurrency
    });
    worker.on("completed", (job, result) => {
        logger.info({ jobId: job.id, result }, "Worker job completed");
        const current = taskStats.get(result.taskId) ?? {
            requestedBy: job.data.requestedBy,
            totalGroups: normalizeTotalGroups(job.data.totalGroups),
            processedGroups: 0,
            checkedPosts: 0,
            editedPosts: 0,
            skippedPosts: 0,
            errorsCount: 0,
            failedGroups: 0
        };
        current.processedGroups += 1;
        current.checkedPosts += result.checkedPosts;
        current.editedPosts += result.editedPosts;
        current.skippedPosts += result.skippedPosts;
        current.errorsCount += result.errorsCount;
        taskStats.set(result.taskId, current);
        void flushTaskSummary(result.taskId);
    });
    worker.on("failed", (job, err) => {
        logger.error({ jobId: job?.id, err }, "Worker job failed");
        if (!job) {
            return;
        }
        const taskId = job.data.taskId;
        const current = taskStats.get(taskId) ?? {
            requestedBy: job.data.requestedBy,
            totalGroups: normalizeTotalGroups(job.data.totalGroups),
            processedGroups: 0,
            checkedPosts: 0,
            editedPosts: 0,
            skippedPosts: 0,
            errorsCount: 0,
            failedGroups: 0
        };
        current.processedGroups += 1;
        current.failedGroups += 1;
        current.errorsCount += 1;
        taskStats.set(taskId, current);
        void flushTaskSummary(taskId);
    });
    logger.info({
        queue: shared_1.QUEUE_NAMES.VK_RED_POSTS,
        workerConcurrency: env.workerConcurrency,
        vkRps: env.vkRps
    }, "Worker started");
}
bootstrap().catch((error) => {
    logger.error({ err: error }, "Worker bootstrap failed");
    process.exit(1);
});
//# sourceMappingURL=index.js.map