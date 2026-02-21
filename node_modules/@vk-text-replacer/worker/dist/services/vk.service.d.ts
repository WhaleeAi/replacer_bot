import type { Logger } from "pino";
import type { RateLimitService } from "./rateLimit.service";
import type { VkWallComment, VkWallPost } from "@vk-text-replacer/shared";
interface VkServiceOptions {
    apiVersion: string;
    logger: Logger;
    rateLimitService: RateLimitService;
}
export interface VkService {
    getWallPostsPage(vkAccessToken: string, groupId: number, offset: number, count: number): Promise<VkWallPost[]>;
    getWallCommentsPage(vkAccessToken: string, groupId: number, postId: number, offset: number, count: number): Promise<VkWallComment[]>;
    editWallPost(args: {
        vkAccessToken: string;
        groupId: number;
        postId: number;
        message: string;
        attachments?: string;
    }): Promise<void>;
    openWallComments(vkAccessToken: string, groupId: number, postId: number): Promise<void>;
    closeWallComments(vkAccessToken: string, groupId: number, postId: number): Promise<void>;
    deleteWallComment(vkAccessToken: string, groupId: number, commentId: number): Promise<void>;
    createWallCommentFromGroup(args: {
        vkAccessToken: string;
        groupId: number;
        postId: number;
        message: string;
    }): Promise<void>;
}
export declare function createVkService(options: VkServiceOptions): VkService;
export {};
