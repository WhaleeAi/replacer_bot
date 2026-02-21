"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBaseHandlers = registerBaseHandlers;
exports.sendMessage = sendMessage;
const shared_1 = require("@vk-text-replacer/shared");
function extractCommandName(text) {
    const token = text.split(/\s+/)[0] ?? "";
    return token.slice(1).split("@")[0]?.toLowerCase() ?? "";
}
function registerBaseHandlers(bot, options) {
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
            await ctx.reply("Требуется авторизация. Нажмите /start и введите пароль.");
            return;
        }
        let allowed = options.state.isAuthorized(userId);
        if (!allowed) {
            allowed = await (0, shared_1.isUserAuthGranted)(options.databaseUrl, userId);
            if (allowed) {
                options.state.authorize(userId);
            }
        }
        if (!allowed) {
            await ctx.reply("Требуется авторизация. Нажмите /start и введите пароль.");
            return;
        }
        await next();
    });
    bot.catch((err) => {
        options.logger.error({ err }, "Unhandled Telegram bot error");
    });
}
async function sendMessage(chatId, text) {
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
//# sourceMappingURL=telegram.service.js.map