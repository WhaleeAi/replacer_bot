import { InlineKeyboard, type Bot, type Context } from "grammy";
import type { Logger } from "pino";
import { ensureUser, isUserRegistered } from "@vk-text-replacer/shared";
import type { StateService } from "../services/state.service";

interface AuthFlowOptions {
  databaseUrl: string;
  adminTgUserId: number;
  logger: Logger;
  state: StateService;
}

function buildApprovalKeyboard(userId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("Approve", `approve:${userId}`)
    .text("Decline", `decline:${userId}`);
}

function formatRequestText(ctx: Context, requesterId: number): string {
  const username = ctx.from?.username ? `@${ctx.from.username}` : "(no username)";
  const firstName = ctx.from?.first_name ?? "";
  const lastName = ctx.from?.last_name ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || "(no name)";
  return [
    "Новый запрос на доступ к боту:",
    `user_id: ${requesterId}`,
    `username: ${username}`,
    `name: ${fullName}`
  ].join("\n");
}

export function registerAuthFlow(bot: Bot<Context>, options: AuthFlowOptions): void {
  bot.command("start", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }

    const registered = await isUserRegistered(options.databaseUrl, userId);
    if (registered) {
      options.state.authorize(userId);
      return;
    }

    options.state.clearRedPostsState(userId);
    options.state.clearAddPackState(userId);
    options.state.clearRedCommentsState(userId);

    if (options.adminTgUserId <= 0) {
      await ctx.reply("Admin is not configured. Contact support.");
      return;
    }

    try {
      await ctx.api.sendMessage(options.adminTgUserId, formatRequestText(ctx, userId), {
        reply_markup: buildApprovalKeyboard(userId)
      });
      await ctx.reply("Запрос отправлен админу. Подождите одобрения.");
    } catch (error) {
      options.logger.error({ err: error, userId }, "Failed to send access request to admin");
      await ctx.reply("Не удалось отправить запрос админу. Попробуйте позже.");
    }
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "/start - request access",
        "/help - help",
        "/add_pack - create pack from public links",
        "/red_posts - run text replacement",
        "/red_comments - replace comments under matched posts"
      ].join("\n")
    );
  });

  bot.callbackQuery(/^approve:(\d+)$/, async (ctx) => {
    if (ctx.from?.id !== options.adminTgUserId) {
      await ctx.answerCallbackQuery({ text: "Only admin can approve." });
      return;
    }

    const requestedUserId = Number(ctx.match?.[1]);
    if (!Number.isFinite(requestedUserId) || requestedUserId <= 0) {
      await ctx.answerCallbackQuery({ text: "Invalid user id." });
      return;
    }

    await ensureUser(options.databaseUrl, requestedUserId);
    options.logger.info({ requestedUserId, adminId: ctx.from.id }, "User approved");

    await ctx.answerCallbackQuery({ text: "Approved" });
    try {
      await ctx.api.sendMessage(requestedUserId, "Доступ одобрен. Теперь вы можете использовать команды бота (/help).");
    } catch (error) {
      options.logger.warn({ err: error, requestedUserId }, "Failed to notify approved user");
    }
    if (ctx.callbackQuery.message) {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\nStatus: approved`);
    }
  });

  bot.callbackQuery(/^decline:(\d+)$/, async (ctx) => {
    if (ctx.from?.id !== options.adminTgUserId) {
      await ctx.answerCallbackQuery({ text: "Only admin can decline." });
      return;
    }

    const requestedUserId = Number(ctx.match?.[1]);
    if (!Number.isFinite(requestedUserId) || requestedUserId <= 0) {
      await ctx.answerCallbackQuery({ text: "Invalid user id." });
      return;
    }

    options.logger.info({ requestedUserId, adminId: ctx.from.id }, "User declined");
    await ctx.answerCallbackQuery({ text: "Declined" });
    try {
      await ctx.api.sendMessage(requestedUserId, "Access request declined.");
    } catch (error) {
      options.logger.warn({ err: error, requestedUserId }, "Failed to notify declined user");
    }
    if (ctx.callbackQuery.message) {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\nStatus: declined`);
    }
  });
}
