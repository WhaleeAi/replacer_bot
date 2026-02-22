import { type Bot, type Context } from "grammy";
import { API } from "vk-io";
import type { Logger } from "pino";
import type { StateService } from "../services/state.service";
interface RedPacksFlowOptions {
    apiVersion: string;
    databaseUrl: string;
    logger: Logger;
    state: StateService;
    vkApi: API | null;
}
export declare function registerRedPacksFlow(bot: Bot<Context>, options: RedPacksFlowOptions): void;
export {};
