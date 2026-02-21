import type { Job } from "bullmq";
import type { VkRedCommentsJobPayload, VkRedPostJobResult } from "@vk-text-replacer/shared";
import type { Logger } from "pino";
import type { VkService } from "../services/vk.service";
interface ProcessCommentsContext {
    logger: Logger;
    vkService: VkService;
}
export declare function processCommentsJob(job: Job<VkRedCommentsJobPayload>, context: ProcessCommentsContext): Promise<VkRedPostJobResult>;
export {};
