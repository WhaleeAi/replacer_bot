import type { Bot, Context } from "grammy";
import type { Logger } from "pino";
import type { StateService } from "../services/state.service";
import { verifyUserPassword } from "@vk-text-replacer/shared";

interface AuthFlowOptions {
  databaseUrl: string;
  logger: Logger;
  state: StateService;
}

export function registerAuthFlow(bot: Bot<Context>, options: AuthFlowOptions): void {
  bot.command("start", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }
    options.state.requestAuth(userId);
    options.state.clearRedPostsState(userId);
    await ctx.reply("Введите ваш пароль:");
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "/start - start auth",
        "/help - help",
        "/red_posts - run text replacement"
      ].join("\n")
    );
  });

  bot.on("message:text", async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !options.state.isAuthRequested(userId)) {
      await next();
      return;
    }

    const text = (ctx.message.text ?? "").trim();
    if (!text || text.startsWith("/")) {
      await next();
      return;
    }

    const allowed = await verifyUserPassword(options.databaseUrl, userId, text);
    options.logger.info(
      { userId, username: ctx.from?.username, allowed },
      "Auth attempt received"
    );

    if (allowed) {
      options.state.authorize(userId);
      await ctx.reply("Авторизация успешна. Доступна команда /red_posts.");
      return;
    }

    options.state.requestAuth(userId);
    await ctx.reply("Неверный пароль или пользователь не заведён в БД.\nВведите пароль:");
  });
}
