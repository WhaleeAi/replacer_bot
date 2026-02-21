import type { Bot, Context } from "grammy";
import type { Logger } from "pino";
import type { StateService } from "../services/state.service";
interface AuthFlowOptions {
    databaseUrl: string;
    logger: Logger;
    state: StateService;
}
export declare function registerAuthFlow(bot: Bot<Context>, options: AuthFlowOptions): void;
export {};
