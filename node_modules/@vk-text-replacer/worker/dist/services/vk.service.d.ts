import type { Logger } from "pino";
import type { RateLimitService } from "./rateLimit.service";
import type { VkWallPost } from "@vk-text-replacer/shared";
interface VkServiceOptions {
    apiVersion: string;
    tokensByGroupId: Record<string, string>;
    logger: Logger;
    rateLimitService: RateLimitService;
}
export interface VkService {
    getWallPostsPage(groupId: number, offset: number, count: number): Promise<VkWallPost[]>;
    editWallPost(args: {
        groupId: number;
        postId: number;
        message: string;
        attachments?: string;
    }): Promise<void>;
}
export declare function createVkService(options: VkServiceOptions): VkService;
export {};
