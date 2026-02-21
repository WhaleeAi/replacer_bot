import type { Logger } from "pino";
import type { RateLimitService } from "./rateLimit.service";
import type { VkWallPost } from "@vk-text-replacer/shared";
interface VkServiceOptions {
    apiVersion: string;
    logger: Logger;
    rateLimitService: RateLimitService;
}
export interface VkService {
    getWallPostsPage(vkAccessToken: string, groupId: number, offset: number, count: number): Promise<VkWallPost[]>;
    editWallPost(args: {
        vkAccessToken: string;
        groupId: number;
        postId: number;
        message: string;
        attachments?: string;
    }): Promise<void>;
}
export declare function createVkService(options: VkServiceOptions): VkService;
export {};
