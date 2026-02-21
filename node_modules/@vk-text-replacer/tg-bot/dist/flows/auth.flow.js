"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthFlow = registerAuthFlow;
const shared_1 = require("@vk-text-replacer/shared");
function registerAuthFlow(bot, options) {
    bot.command("start", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            return;
        }
        options.state.requestAuth(userId);
        options.state.clearRedPostsState(userId);
        options.state.clearAddPackState(userId);
        options.state.clearRedCommentsState(userId);
        await ctx.reply("Введите ваш пароль:");
    });
    bot.command("help", async (ctx) => {
        await ctx.reply([
            "/start - start auth",
            "/help - help",
            "/add_pack - create pack from public links",
            "/red_posts - run text replacement",
            "/red_comments - replace comments under matched posts"
        ].join("\n"));
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
        const allowed = await (0, shared_1.verifyUserPassword)(options.databaseUrl, userId, text);
        options.logger.info({ userId, username: ctx.from?.username, allowed }, "Auth attempt received");
        if (allowed) {
            options.state.authorize(userId);
            await ctx.reply("Авторизация успешна. Доступна команда /red_posts.");
            return;
        }
        options.state.requestAuth(userId);
        await ctx.reply("Неверный пароль или пользователь не заведён в БД.\nВведите пароль:");
    });
}
//# sourceMappingURL=auth.flow.js.map