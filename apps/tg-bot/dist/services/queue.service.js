"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQueueService = createQueueService;
const bullmq_1 = require("bullmq");
const shared_1 = require("@vk-text-replacer/shared");
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
function createQueueService(redisUrl, logger) {
    const connection = createRedisConnection(redisUrl);
    const queue = new bullmq_1.Queue(shared_1.QUEUE_NAMES.VK_RED_POSTS, {
        connection
    });
    return {
        async enqueueRedPostsJobs(task) {
            await Promise.all(task.groupIds.map((groupId) => queue.add("vk-red-posts-public", {
                taskId: task.taskId,
                requestedBy: task.requestedBy,
                totalGroups: task.groupIds.length,
                groupId,
                findText: task.findText,
                replaceText: task.replaceText,
                cutoffDays: task.cutoffDays
            }, {
                removeOnComplete: true,
                removeOnFail: 100
            })));
            logger.info({ taskId: task.taskId, groups: task.groupIds.length }, "BullMQ jobs created");
            return task.groupIds.length;
        }
    };
}
//# sourceMappingURL=queue.service.js.map