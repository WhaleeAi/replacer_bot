"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthFlow = registerAuthFlow;
function registerAuthFlow(bot, options) {
    bot.command("start", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            return;
        }
        options.state.requestAuth(userId);
        options.state.clearRedPostsState(userId);
        await ctx.reply("Введите ключ доступа:");
    });
    bot.command("help", async (ctx) => {
        await ctx.reply([
            "/start - начать авторизацию",
            "/help - помощь",
            "/red_posts - запустить замену текста в постах"
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
        const allowed = options.adminKey.length > 0 && text === options.adminKey;
        options.logger.info({ userId, username: ctx.from?.username, allowed }, "Auth attempt received");
        if (allowed) {
            options.state.authorize(userId);
            await ctx.reply("Авторизация успешна. Теперь доступна команда /red_posts.");
            return;
        }
        options.state.requestAuth(userId);
        await ctx.reply("Неверный ключ. Попробуйте снова.\nВведите ключ доступа:");
    });
}
//# sourceMappingURL=auth.flow.js.map