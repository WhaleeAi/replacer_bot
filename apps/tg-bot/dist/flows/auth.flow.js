"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthFlow = registerAuthFlow;
const grammy_1 = require("grammy");
const shared_1 = require("@vk-text-replacer/shared");
function buildApprovalKeyboard(userId) {
    return new grammy_1.InlineKeyboard()
        .text("Принять", `approve:${userId}`)
        .text("Отклонить", `decline:${userId}`);
}
function formatRequestText(ctx, requesterId) {
    const username = ctx.from?.username ? `@${ctx.from.username}` : "(нет username)";
    const firstName = ctx.from?.first_name ?? "";
    const lastName = ctx.from?.last_name ?? "";
    const fullName = `${firstName} ${lastName}`.trim() || "(нет имени)";
    return [
        "Новый запрос на доступ к боту:",
        `user_id: ${requesterId}`,
        `username: ${username}`,
        `name: ${fullName}`
    ].join("\n");
}
function registerAuthFlow(bot, options) {
    bot.command("start", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            return;
        }
        const registered = await (0, shared_1.isUserRegistered)(options.databaseUrl, userId);
        if (registered) {
            options.state.authorize(userId);
            return;
        }
        options.state.clearRedPostsState(userId);
        options.state.clearAddPackState(userId);
        options.state.clearPackEditState(userId);
        options.state.clearRedCommentsState(userId);
        if (options.adminTgUserId <= 0) {
            await ctx.reply("Администратор не настроен. Обратитесь в поддержку.");
            return;
        }
        try {
            await ctx.api.sendMessage(options.adminTgUserId, formatRequestText(ctx, userId), {
                reply_markup: buildApprovalKeyboard(userId)
            });
            await ctx.reply("Запрос отправлен администратору. Ожидайте одобрения.");
        }
        catch (error) {
            options.logger.error({ err: error, userId }, "Failed to send access request to admin");
            await ctx.reply("Не удалось отправить запрос администратору. Попробуйте позже.");
        }
    });
    bot.command("help", async (ctx) => {
        await ctx.reply([
            "/start - запросить доступ",
            "/help - помощь",
            "/red_packs - управление паками",
            "/red_posts - замена текста в постах",
            "/red_comments - замена комментариев под постами"
        ].join("\n"));
    });
    bot.callbackQuery(/^approve:(\d+)$/, async (ctx) => {
        if (ctx.from?.id !== options.adminTgUserId) {
            await ctx.answerCallbackQuery({ text: "Только админ может одобрять." });
            return;
        }
        const requestedUserId = Number(ctx.match?.[1]);
        if (!Number.isFinite(requestedUserId) || requestedUserId <= 0) {
            await ctx.answerCallbackQuery({ text: "Некорректный ID пользователя." });
            return;
        }
        await (0, shared_1.ensureUser)(options.databaseUrl, requestedUserId);
        options.logger.info({ requestedUserId, adminId: ctx.from.id }, "User approved");
        await ctx.answerCallbackQuery({ text: "Одобрено" });
        try {
            await ctx.api.sendMessage(requestedUserId, "Доступ одобрен. Теперь вы можете использовать команды бота (/help).");
        }
        catch (error) {
            options.logger.warn({ err: error, requestedUserId }, "Failed to notify approved user");
        }
        if (ctx.callbackQuery.message) {
            await ctx.editMessageReplyMarkup({ reply_markup: undefined });
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\nСтатус: одобрено`);
        }
    });
    bot.callbackQuery(/^decline:(\d+)$/, async (ctx) => {
        if (ctx.from?.id !== options.adminTgUserId) {
            await ctx.answerCallbackQuery({ text: "Только админ может отклонять." });
            return;
        }
        const requestedUserId = Number(ctx.match?.[1]);
        if (!Number.isFinite(requestedUserId) || requestedUserId <= 0) {
            await ctx.answerCallbackQuery({ text: "Некорректный ID пользователя." });
            return;
        }
        options.logger.info({ requestedUserId, adminId: ctx.from.id }, "User declined");
        await ctx.answerCallbackQuery({ text: "Отклонено" });
        try {
            await ctx.api.sendMessage(requestedUserId, "Запрос на доступ отклонён.");
        }
        catch (error) {
            options.logger.warn({ err: error, requestedUserId }, "Failed to notify declined user");
        }
        if (ctx.callbackQuery.message) {
            await ctx.editMessageReplyMarkup({ reply_markup: undefined });
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\nСтатус: отклонено`);
        }
    });
}
//# sourceMappingURL=auth.flow.js.map