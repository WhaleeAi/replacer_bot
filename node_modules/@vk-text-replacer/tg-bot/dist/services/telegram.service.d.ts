import type { Bot, Context } from "grammy";
import type { Logger } from "pino";
import type { StateService } from "./state.service";
interface RegisterTelegramBaseOptions {
    logger: Logger;
    state: StateService;
}
export declare function registerBaseHandlers(bot: Bot<Context>, options: RegisterTelegramBaseOptions): void;
export declare function sendMessage(chatId: number, text: string): Promise<void>;
export {};
