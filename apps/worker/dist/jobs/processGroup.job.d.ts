import type { Job } from "bullmq";
import type { VkRedPostJobPayload, VkRedPostJobResult } from "@vk-text-replacer/shared";
import type { Logger } from "pino";
import type { VkService } from "../services/vk.service";
import type { ReplaceService } from "../services/replace.service";
interface ProcessGroupContext {
    logger: Logger;
    vkService: VkService;
    replaceService: ReplaceService;
}
export declare function processGroupJob(job: Job<VkRedPostJobPayload>, context: ProcessGroupContext): Promise<VkRedPostJobResult>;
export {};
