import { type RedPostsTask } from "@vk-text-replacer/shared";
import type { Logger } from "pino";
export interface QueueService {
    enqueueRedPostsJobs(task: RedPostsTask): Promise<number>;
}
export declare function createQueueService(redisUrl: string, logger: Logger): QueueService;
