import type { Bot, Context } from "grammy";
import type { Logger } from "pino";
import type { API } from "vk-io";
import type { StateService } from "../services/state.service";
interface AddPackFlowOptions {
    databaseUrl: string;
    logger: Logger;
    state: StateService;
    vkApi: API | null;
}
export declare function registerAddPackFlow(bot: Bot<Context>, options: AddPackFlowOptions): void;
export {};
