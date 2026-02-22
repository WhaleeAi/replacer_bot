import { type Bot, type Context } from "grammy";
import { API } from "vk-io";
import type { Logger } from "pino";
import type { QueueService } from "../services/queue.service";
import type { StateService } from "../services/state.service";
interface RedCommentsFlowOptions {
    apiVersion: string;
    databaseUrl: string;
    queueService: QueueService;
    logger: Logger;
    state: StateService;
    vkApi: API | null;
}
export declare function registerRedCommentsFlow(bot: Bot<Context>, options: RedCommentsFlowOptions): void;
export {};
