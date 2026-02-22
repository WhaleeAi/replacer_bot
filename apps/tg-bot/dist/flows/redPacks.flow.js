"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRedPacksFlow = registerRedPacksFlow;
const grammy_1 = require("grammy");
const vk_io_1 = require("vk-io");
const shared_1 = require("@vk-text-replacer/shared");
const parsePublicLinks_1 = require("../utils/parsePublicLinks");
function menuKeyboard() {
    return new grammy_1.InlineKeyboard()
        .text("Add pack", "rp:add")
        .text("Edit pack", "rp:edit");
}
function packsListText(packs) {
    if (!packs.length) {
        return "Packs: none";
    }
    return ["Packs:", ...packs.map((pack) => `- ${pack.name} (${pack.groupsCount})`)].join("\n");
}
function packLinksToText(groupIds) {
    if (!groupIds.length) {
        return "No groups in pack.";
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
        await ctx.reply(`Pack menu\n\n${packsListText(packs)}`, { reply_markup: menuKeyboard() });
    });
    bot.callbackQuery("rp:add", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery();
            return;
        }
        options.state.clearPackEditState(userId);
        options.state.setAddPackState(userId, { step: "await_name", name: "" });
        await ctx.answerCallbackQuery({ text: "Add pack flow" });
        await ctx.reply("Send pack name:");
    });
    bot.callbackQuery("rp:edit", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery();
            return;
        }
        const packs = await (0, shared_1.listUserPacks)(options.databaseUrl, userId);
        if (!packs.length) {
            await ctx.answerCallbackQuery({ text: "No packs yet." });
            await ctx.reply("No packs found. Use 'Add pack'.", { reply_markup: menuKeyboard() });
            return;
        }
        const keyboard = new grammy_1.InlineKeyboard();
        for (const pack of packs) {
            keyboard.text(`${pack.name} (${pack.groupsCount})`, `rp:open:${pack.id}`).row();
        }
        await ctx.answerCallbackQuery({ text: "Choose pack" });
        await ctx.reply("Choose pack to edit:", { reply_markup: keyboard });
    });
    bot.callbackQuery(/^rp:open:(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery();
            return;
        }
        const packId = Number(ctx.match?.[1]);
        if (!Number.isFinite(packId) || packId <= 0) {
            await ctx.answerCallbackQuery({ text: "Invalid pack id." });
            return;
        }
        const packs = await (0, shared_1.listUserPacks)(options.databaseUrl, userId);
        const selectedPack = packs.find((pack) => pack.id === packId);
        if (!selectedPack) {
            await ctx.answerCallbackQuery({ text: "Pack not found." });
            return;
        }
        const groupIds = await (0, shared_1.getUserPackGroupIds)(options.databaseUrl, userId, packId);
        if (!groupIds) {
            await ctx.answerCallbackQuery({ text: "Pack not found." });
            return;
        }
        const keyboard = new grammy_1.InlineKeyboard()
            .text("Delete pack", `rp:delete:${packId}`)
            .row()
            .text("Add links", `rp:addlinks:${packId}`);
        await ctx.answerCallbackQuery({ text: "Pack opened" });
        if (ctx.callbackQuery.message) {
            await ctx.editMessageText("Pack selected.");
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
            await ctx.answerCallbackQuery({ text: "Invalid pack id." });
            return;
        }
        const deleted = await (0, shared_1.deleteUserPack)(options.databaseUrl, userId, packId);
        await ctx.answerCallbackQuery({ text: deleted ? "Pack deleted." : "Pack not found." });
        await ctx.reply(deleted ? "Pack deleted." : "Pack not found.");
    });
    bot.callbackQuery(/^rp:addlinks:(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery();
            return;
        }
        const packId = Number(ctx.match?.[1]);
        if (!Number.isFinite(packId) || packId <= 0) {
            await ctx.answerCallbackQuery({ text: "Invalid pack id." });
            return;
        }
        const groupIds = await (0, shared_1.getUserPackGroupIds)(options.databaseUrl, userId, packId);
        if (!groupIds) {
            await ctx.answerCallbackQuery({ text: "Pack not found." });
            return;
        }
        options.state.clearAddPackState(userId);
        options.state.setPackEditState(userId, { step: "await_links", packId });
        await ctx.answerCallbackQuery({ text: "Send links to append" });
        await ctx.reply("Send links to add to this pack, one per line:");
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
                    await ctx.reply("Pack name is too long (max 100 chars). Send another name:");
                    return;
                }
                options.state.setAddPackState(userId, { step: "await_links", name: text });
                await ctx.reply("Теперь отправьте ссылки на сообщества, по одной в строке:");
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
                    "No valid public links found.",
                    parsed.errors.length > 0 ? `Invalid links:\n${parsed.errors.join("\n")}` : "",
                    "Send links again, one per line:"
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
                    `Pack created: ${addState.name}`,
                    `Pack id: ${packId}`,
                    `Groups: ${parsed.groupIds.length}`,
                    parsed.errors.length > 0 ? `Skipped links:\n${parsed.errors.join("\n")}` : ""
                ]
                    .filter(Boolean)
                    .join("\n\n"));
            }
            catch (error) {
                options.logger.error({ err: error, userId, packName: addState.name }, "Pack create failed");
                await ctx.reply("Failed to create pack. Maybe this name already exists.");
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
                    "No valid public links found.",
                    parsed.errors.length > 0 ? `Invalid links:\n${parsed.errors.join("\n")}` : "",
                    "Send links again, one per line:"
                ]
                    .filter(Boolean)
                    .join("\n\n"));
                return;
            }
            const added = await (0, shared_1.appendUserPackGroups)(options.databaseUrl, userId, editState.packId, parsed.groupIds);
            if (added === null) {
                options.state.clearPackEditState(userId);
                await ctx.reply("Pack not found.");
                return;
            }
            options.state.clearPackEditState(userId);
            await ctx.reply([
                `Added links to pack #${editState.packId}: ${added}`,
                parsed.errors.length > 0 ? `Skipped links:\n${parsed.errors.join("\n")}` : ""
            ]
                .filter(Boolean)
                .join("\n\n"));
            return;
        }
        await next();
    });
}
//# sourceMappingURL=redPacks.flow.js.map