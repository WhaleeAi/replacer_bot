import { Worker } from "bullmq";
import {
  QUEUE_NAMES,
  createLogger,
  ensureDatabaseSchema,
  getEnv,
  type VkRedPostJobPayload,
  type VkRedPostJobResult
} from "@vk-text-replacer/shared";
import { processGroupJob } from "./jobs/processGroup.job";
import { createVkService } from "./services/vk.service";
import { createRateLimitService } from "./services/rateLimit.service";
import { createReplaceService } from "./services/replace.service";
import { sendMessage } from "./services/telegram.service";
import dotenv from "dotenv";
import path from "node:path";

const logger = createLogger("worker");
const rootEnvPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: rootEnvPath, override: true });

function createRedisConnection(redisUrl: string) {
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
    maxRetriesPerRequest: null as null
  };
}

async function bootstrap(): Promise<void> {
  const env = getEnv();
  await ensureDatabaseSchema(env.databaseUrl, logger);
  const connection = createRedisConnection(env.redisUrl);
  const rateLimitService = createRateLimitService(env.vkRps);

  const vkService = createVkService({
    apiVersion: env.vkApiVersion,
    tokensByGroupId: env.vkTokens,
    logger,
    rateLimitService
  });
  const replaceService = createReplaceService();
  const taskStats = new Map<
    string,
    {
      requestedBy: number;
      totalGroups: number;
      processedGroups: number;
      checkedPosts: number;
      editedPosts: number;
      skippedPosts: number;
      errorsCount: number;
      failedGroups: number;
    }
  >();

  function normalizeTotalGroups(value: number | undefined): number {
    return Number.isFinite(value) && (value ?? 0) > 0 ? (value as number) : 1;
  }

  async function flushTaskSummary(taskId: string): Promise<void> {
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
      await sendMessage(stats.requestedBy, text);
    } catch (error) {
      logger.warn({ err: error, taskId }, "Failed to send final task summary");
    }
  }

  const worker = new Worker<VkRedPostJobPayload, VkRedPostJobResult>(
    QUEUE_NAMES.VK_RED_POSTS,
    async (job) => {
      return processGroupJob(job, {
        logger,
        vkService,
        replaceService
      });
    },
    {
      connection,
      concurrency: env.workerConcurrency
    }
  );

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

  logger.info(
    {
      queue: QUEUE_NAMES.VK_RED_POSTS,
      workerConcurrency: env.workerConcurrency,
      vkRps: env.vkRps
    },
    "Worker started"
  );
}

bootstrap().catch((error: unknown) => {
  logger.error({ err: error }, "Worker bootstrap failed");
  process.exit(1);
});
