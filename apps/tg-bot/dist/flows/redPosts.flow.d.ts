import { type Bot, type Context } from "grammy";
import type { Logger } from "pino";
import type { QueueService } from "../services/queue.service";
import type { API } from "vk-io";
import type { StateService } from "../services/state.service";
interface RedPostsFlowOptions {
    databaseUrl: string;
    queueService: QueueService;
    logger: Logger;
    state: StateService;
    vkApi: API | null;
}
export declare function registerRedPostsFlow(bot: Bot<Context>, options: RedPostsFlowOptions): void;
export {};
