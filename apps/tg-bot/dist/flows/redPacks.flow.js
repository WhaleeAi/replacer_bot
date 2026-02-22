"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRedPacksFlow = registerRedPacksFlow;
const grammy_1 = require("grammy");
const vk_io_1 = require("vk-io");
const shared_1 = require("@vk-text-replacer/shared");
const parsePublicLinks_1 = require("../utils/parsePublicLinks");
function menuKeyboard() {
    return new grammy_1.InlineKeyboard()
        .text("Добавить пак", "rp:add")
        .text("Редактировать пак", "rp:edit");
}
function packsListText(packs) {
    if (!packs.length) {
        return "Паки: нет";
    }
    return ["Паки:", ...packs.map((pack) => `- ${pack.name} (${pack.groupsCount})`)].join("\n");
}
function packLinksToText(groupIds) {
    if (!groupIds.length) {
        return "В паке нет сообществ.";
    }
    return groupIds.map((id) => `https://vk.com/club${id}`).join("\n");
}
async function getResolveApi(options, userId) {
    if (options.vkApi) {
        return options.vkApi;
    }
    const stored = await (0, shared_1.getVkAccessTokenByTelegramUserId)(options.databaseUrl, userId);
    if (!stored?.accessToken) {
        return null;
    }
    return new vk_io_1.API({ token: stored.accessToken, apiVersion: options.apiVersion });
}
function registerRedPacksFlow(bot, options) {
    bot.command("red_packs", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            return;
        }
        options.state.clearRedPostsState(userId);
        options.state.clearRedCommentsState(userId);
        options.state.clearAddPackState(userId);
        options.state.clearPackEditState(userId);
        const packs = await (0, shared_1.listUserPacks)(options.databaseUrl, userId);
        await ctx.reply(`Меню паков\n\n${packsListText(packs)}`, { reply_markup: menuKeyboard() });
    });
    bot.callbackQuery("rp:add", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery();
            return;
        }
        options.state.clearPackEditState(userId);
        options.state.setAddPackState(userId, { step: "await_name", name: "" });
        await ctx.answerCallbackQuery({ text: "Режим добавления пака" });
        await ctx.reply("Введите название пака:");
    });
    bot.callbackQuery("rp:edit", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery();
            return;
        }
        const packs = await (0, shared_1.listUserPacks)(options.databaseUrl, userId);
        if (!packs.length) {
            await ctx.answerCallbackQuery({ text: "Паков пока нет." });
            await ctx.reply("Паки не найдены. Выберите «Добавить пак».", { reply_markup: menuKeyboard() });
            return;
        }
        const keyboard = new grammy_1.InlineKeyboard();
        for (const pack of packs) {
            keyboard.text(`${pack.name} (${pack.groupsCount})`, `rp:open:${pack.id}`).row();
        }
        await ctx.answerCallbackQuery({ text: "Выберите пак" });
        await ctx.reply("Выберите пак для редактирования:", { reply_markup: keyboard });
    });
    bot.callbackQuery(/^rp:open:(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery();
            return;
        }
        const packId = Number(ctx.match?.[1]);
        if (!Number.isFinite(packId) || packId <= 0) {
            await ctx.answerCallbackQuery({ text: "Некорректный ID пака." });
            return;
        }
        const packs = await (0, shared_1.listUserPacks)(options.databaseUrl, userId);
        const selectedPack = packs.find((pack) => pack.id === packId);
        if (!selectedPack) {
            await ctx.answerCallbackQuery({ text: "Пак не найден." });
            return;
        }
        const groupIds = await (0, shared_1.getUserPackGroupIds)(options.databaseUrl, userId, packId);
        if (!groupIds) {
            await ctx.answerCallbackQuery({ text: "Пак не найден." });
            return;
        }
        const keyboard = new grammy_1.InlineKeyboard()
            .text("Удалить пак", `rp:delete:${packId}`)
            .row()
            .text("Добавить ссылки", `rp:addlinks:${packId}`);
        await ctx.answerCallbackQuery({ text: "Пак открыт" });
        if (ctx.callbackQuery.message) {
            await ctx.editMessageText("Пак выбран.");
        }
        await ctx.reply(`${selectedPack.name}\n\n${packLinksToText(groupIds)}`, { reply_markup: keyboard });
    });
    bot.callbackQuery(/^rp:delete:(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery();
            return;
        }
        const packId = Number(ctx.match?.[1]);
        if (!Number.isFinite(packId) || packId <= 0) {
            await ctx.answerCallbackQuery({ text: "Некорректный ID пака." });
            return;
        }
        const deleted = await (0, shared_1.deleteUserPack)(options.databaseUrl, userId, packId);
        await ctx.answerCallbackQuery({ text: deleted ? "Пак удалён." : "Пак не найден." });
        await ctx.reply(deleted ? "Пак удалён." : "Пак не найден.");
    });
    bot.callbackQuery(/^rp:addlinks:(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery();
            return;
        }
        const packId = Number(ctx.match?.[1]);
        if (!Number.isFinite(packId) || packId <= 0) {
            await ctx.answerCallbackQuery({ text: "Некорректный ID пака." });
            return;
        }
        const groupIds = await (0, shared_1.getUserPackGroupIds)(options.databaseUrl, userId, packId);
        if (!groupIds) {
            await ctx.answerCallbackQuery({ text: "Пак не найден." });
            return;
        }
        options.state.clearAddPackState(userId);
        options.state.setPackEditState(userId, { step: "await_links", packId });
        await ctx.answerCallbackQuery({ text: "Отправьте ссылки для добавления" });
        await ctx.reply("Отправьте ссылки для добавления в этот пак (по одной в строке):");
    });
    bot.on("message:text", async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await next();
            return;
        }
        const text = (ctx.message.text ?? "").trim();
        if (!text || text.startsWith("/")) {
            await next();
            return;
        }
        const addState = options.state.getAddPackState(userId);
        if (addState) {
            if (addState.step === "await_name") {
                if (text.length > 100) {
                    await ctx.reply("Название пака слишком длинное (максимум 100 символов). Введите другое:");
                    return;
                }
                options.state.setAddPackState(userId, { step: "await_links", name: text });
                await ctx.reply("Теперь отправьте ссылки на сообщества (по одной в строке):");
                return;
            }
            const links = text
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            const resolveApi = await getResolveApi(options, userId);
            const parsed = await (0, parsePublicLinks_1.parsePublicLinks)(links, { vkApi: resolveApi });
            if (parsed.groupIds.length === 0) {
                await ctx.reply([
                    "Не удалось обработать ни одной ссылки.",
                    parsed.errors.length > 0 ? `Невалидные ссылки:\n${parsed.errors.join("\n")}` : "",
                    "Отправьте ссылки снова (по одной в строке):"
                ]
                    .filter(Boolean)
                    .join("\n\n"));
                return;
            }
            try {
                const packId = await (0, shared_1.createUserPack)(options.databaseUrl, userId, addState.name, parsed.groupIds);
                options.state.clearAddPackState(userId);
                options.logger.info({ userId, packId, packName: addState.name }, "Pack created");
                await ctx.reply([
                    `Пак создан: ${addState.name}`,
                    `ID пака: ${packId}`,
                    `Сообществ: ${parsed.groupIds.length}`,
                    parsed.errors.length > 0 ? `Пропущенные ссылки:\n${parsed.errors.join("\n")}` : ""
                ]
                    .filter(Boolean)
                    .join("\n\n"));
            }
            catch (error) {
                options.logger.error({ err: error, userId, packName: addState.name }, "Pack create failed");
                await ctx.reply("Не удалось создать пак. Возможно, такое название уже существует.");
            }
            return;
        }
        const editState = options.state.getPackEditState(userId);
        if (editState?.step === "await_links") {
            const links = text
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            const resolveApi = await getResolveApi(options, userId);
            const parsed = await (0, parsePublicLinks_1.parsePublicLinks)(links, { vkApi: resolveApi });
            if (parsed.groupIds.length === 0) {
                await ctx.reply([
                    "Не удалось обработать ни одной ссылки.",
                    parsed.errors.length > 0 ? `Невалидные ссылки:\n${parsed.errors.join("\n")}` : "",
                    "Отправьте ссылки снова (по одной в строке):"
                ]
                    .filter(Boolean)
                    .join("\n\n"));
                return;
            }
            const added = await (0, shared_1.appendUserPackGroups)(options.databaseUrl, userId, editState.packId, parsed.groupIds);
            if (added === null) {
                options.state.clearPackEditState(userId);
                await ctx.reply("Пак не найден.");
                return;
            }
            options.state.clearPackEditState(userId);
            await ctx.reply([
                `Добавлено ссылок в пак #${editState.packId}: ${added}`,
                parsed.errors.length > 0 ? `Пропущенные ссылки:\n${parsed.errors.join("\n")}` : ""
            ]
                .filter(Boolean)
                .join("\n\n"));
            return;
        }
        await next();
    });
}
//# sourceMappingURL=redPacks.flow.js.map