import { Queue } from "bullmq";
import { QUEUE_NAMES, type RedPostsTask, type VkRedPostJobPayload } from "@vk-text-replacer/shared";
import type { Logger } from "pino";

export interface QueueService {
  enqueueRedPostsJobs(task: RedPostsTask): Promise<number>;
}

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

export function createQueueService(redisUrl: string, logger: Logger): QueueService {
  const connection = createRedisConnection(redisUrl);

  const queue = new Queue<VkRedPostJobPayload>(QUEUE_NAMES.VK_RED_POSTS, {
    connection
  });

  return {
    async enqueueRedPostsJobs(task) {
      await Promise.all(
        task.groupIds.map((groupId) =>
          queue.add(
            "vk-red-posts-public",
            {
              taskId: task.taskId,
              requestedBy: task.requestedBy,
              totalGroups: task.groupIds.length,
              groupId,
              findText: task.findText,
              replaceText: task.replaceText,
              cutoffDays: task.cutoffDays
            },
            {
              removeOnComplete: true,
              removeOnFail: 100
            }
          )
        )
      );
      logger.info({ taskId: task.taskId, groups: task.groupIds.length }, "BullMQ jobs created");
      return task.groupIds.length;
    }
  };
}
