export declare const QUEUE_NAMES: {
    readonly PROCESS_GROUP: "process-group";
    readonly VK_RED_POSTS: "vk-red-posts";
};
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
export interface RedPostsJobData {
    chatId: number;
    userId: number;
    groupId: number;
    publicLinks: string[];
    replaceFrom: string;
    replaceTo: string;
}
export interface VkRedPostJobPayload {
    taskId: string;
    requestedBy: number;
    totalGroups: number;
    groupId: number;
    findText: string;
    replaceText: string;
    cutoffDays: number;
}
export interface VkRedPostJobResult {
    taskId: string;
    groupId: number;
    checkedPosts: number;
    editedPosts: number;
    skippedPosts: number;
    errorsCount: number;
}
export interface VkWallAttachmentRef {
    type: string;
    owner_id?: number;
    id?: number;
    access_key?: string;
}
export interface VkWallPost {
    id: number;
    date: number;
    text?: string;
    attachments?: VkWallAttachmentRef[];
}
export interface RedPostsTask {
    taskId: string;
    requestedBy: number;
    groupIds: number[];
    findText: string;
    replaceText: string;
    cutoffDays: number;
    createdAt: string;
}
export interface AppEnv {
    tgBotToken: string;
    adminKey: string;
    databaseUrl: string;
    redisUrl: string;
    vkTokens: Record<string, string>;
    vkApiVersion: string;
    workerConcurrency: number;
    vkRps: number;
}
