import type { Bot, Context } from "grammy";
import type { Logger } from "pino";
import { isUserRegistered } from "@vk-text-replacer/shared";
import type { StateService } from "./state.service";

interface RegisterTelegramBaseOptions {
  databaseUrl: string;
  logger: Logger;
  state: StateService;
}

function extractCommandName(text: string): string {
  const token = text.split(/\s+/)[0] ?? "";
  return token.slice(1).split("@")[0]?.toLowerCase() ?? "";
}

export function registerBaseHandlers(bot: Bot<Context>, options: RegisterTelegramBaseOptions): void {
  bot.use(async (ctx, next) => {
    const text = ctx.message?.text;
    if (!text || !text.startsWith("/")) {
      await next();
      return;
    }

    const command = extractCommandName(text);
    if (command === "start" || command === "help") {
      await next();
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("Требуется доступ. Нажмите /start чтобы отправить запрос.");
      return;
    }

    let allowed = options.state.isAuthorized(userId);
    if (!allowed) {
      allowed = await isUserRegistered(options.databaseUrl, userId);
      if (allowed) {
        options.state.authorize(userId);
      }
    }

    if (!allowed) {
      await ctx.reply("Требуется доступ. Нажмите /start чтобы отправить запрос.");
      return;
    }

    await next();
  });

  bot.catch((err) => {
    options.logger.error({ err }, "Unhandled Telegram bot error");
  });
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TG_BOT_TOKEN ?? "";
  if (!token) {
    throw new Error("TG_BOT_TOKEN is empty");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with HTTP ${response.status}`);
  }
}
