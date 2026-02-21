export const QUEUE_NAMES = {
  PROCESS_GROUP: "process-group",
  VK_RED_POSTS: "vk-red-posts",
  VK_RED_COMMENTS: "vk-red-comments"
} as const;

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
  vkAccessToken: string;
}

export interface VkRedCommentsJobPayload {
  taskId: string;
  requestedBy: number;
  totalGroups: number;
  groupId: number;
  postTextFragment: string;
  oldCommentFragment: string;
  newCommentText: string;
  vkAccessToken: string;
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
  vkAccessToken: string;
  createdAt: string;
}

export interface RedCommentsTask {
  taskId: string;
  requestedBy: number;
  groupIds: number[];
  postTextFragment: string;
  oldCommentFragment: string;
  newCommentText: string;
  vkAccessToken: string;
  createdAt: string;
}

export interface VkWallComment {
  id: number;
  text?: string;
  from_id?: number;
}

export interface AppEnv {
  tgBotToken: string;
  adminTgUserId: number;
  databaseUrl: string;
  redisUrl: string;
  vkApiVersion: string;
  workerConcurrency: number;
  vkRps: number;
}
