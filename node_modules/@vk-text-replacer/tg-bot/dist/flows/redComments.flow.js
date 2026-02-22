"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRedCommentsFlow = registerRedCommentsFlow;
const grammy_1 = require("grammy");
const vk_io_1 = require("vk-io");
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@vk-text-replacer/shared");
const parsePublicLinks_1 = require("../utils/parsePublicLinks");
const textNormalize_1 = require("../utils/textNormalize");
function parseVkTokenInput(raw) {
    const input = raw.trim();
    if (!input) {
        return null;
    }
    if (input.startsWith("vk1.") || input.startsWith("vk2.")) {
        return { accessToken: input, expiresAt: null };
    }
    try {
        const url = new URL(input);
        const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
        const hashParams = new URLSearchParams(hash);
        const accessToken = (hashParams.get("access_token") ?? "").trim();
        if (!accessToken) {
            return null;
        }
        const expiresInRaw = (hashParams.get("expires_in") ?? "").trim();
        const expiresIn = Number(expiresInRaw);
        const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;
        return { accessToken, expiresAt };
    }
    catch {
        return null;
    }
}
function isRecentWithinOneHour(date) {
    if (!date) {
        return false;
    }
    return Date.now() - date.getTime() < 60 * 60 * 1000;
}
function buildPacksKeyboard(packs) {
    if (!packs.length) {
        return null;
    }
    const keyboard = new grammy_1.InlineKeyboard();
    for (const pack of packs) {
        keyboard.text(`${pack.name} (${pack.groupsCount})`, `cpack:${pack.id}`).row();
    }
    return keyboard;
}
async function showLinksPrompt(ctx, packs) {
    const keyboard = buildPacksKeyboard(packs);
    await ctx.reply("Отправьте ссылки на сообщества (по одной в строке) или выберите пак:", keyboard ? { reply_markup: keyboard } : undefined);
}
function registerRedCommentsFlow(bot, options) {
    bot.command("red_comments", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            return;
        }
        options.state.clearRedPostsState(userId);
        options.state.clearAddPackState(userId);
        options.state.clearPackEditState(userId);
        const stored = await (0, shared_1.getVkAccessTokenByTelegramUserId)(options.databaseUrl, userId);
        if (stored && isRecentWithinOneHour(stored.updatedAt)) {
            const packs = await (0, shared_1.listUserPacks)(options.databaseUrl, userId);
            options.state.setRedCommentsState(userId, {
                step: "await_links",
                groupIds: [],
                vkAccessToken: stored.accessToken,
                postTextFragment: "",
                oldCommentFragment: "",
                skippedLinks: []
            });
            await showLinksPrompt(ctx, packs);
            return;
        }
        options.state.setRedCommentsState(userId, {
            step: "await_token",
            groupIds: [],
            vkAccessToken: "",
            postTextFragment: "",
            oldCommentFragment: "",
            skippedLinks: []
        });
        await ctx.reply([
            "1) Перейдите на https://vkhost.github.io/",
            "2) Выберите VK Admin и выдайте доступ",
            "3) Скопируйте адресную строку и отправьте сюда (https://oauth.vk.com/blank.html#access_token=... и т.д.)"
        ].join("\n"));
    });
    bot.callbackQuery(/^cpack:(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery();
            return;
        }
        const state = options.state.getRedCommentsState(userId);
        if (!state || state.step !== "await_links") {
            await ctx.answerCallbackQuery({ text: "Сначала запустите /red_comments." });
            return;
        }
        const packId = Number(ctx.match?.[1]);
        if (!Number.isFinite(packId) || packId <= 0) {
            await ctx.answerCallbackQuery({ text: "Некорректный пак." });
            return;
        }
        const groupIds = await (0, shared_1.getUserPackGroupIds)(options.databaseUrl, userId, packId);
        if (!groupIds || groupIds.length === 0) {
            await ctx.answerCallbackQuery({ text: "Пак пустой или недоступен." });
            return;
        }
        options.state.setRedCommentsState(userId, {
            ...state,
            step: "await_post_fragment",
            groupIds,
            skippedLinks: []
        });
        await ctx.answerCallbackQuery({ text: `Пак выбран (${groupIds.length})` });
        await ctx.reply("Отправьте фрагмент текста поста (под такими постами будут редактироваться комментарии):");
    });
    bot.on("message:text", async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) {
            await next();
            return;
        }
        const state = options.state.getRedCommentsState(userId);
        if (!state) {
            await next();
            return;
        }
        const text = (ctx.message.text ?? "").trim();
        if (!text || text.startsWith("/")) {
            await next();
            return;
        }
        if (state.step === "await_token") {
            const parsedToken = parseVkTokenInput(text);
            if (!parsedToken) {
                await ctx.reply("Не удалось распознать access_token. Отправьте полную callback-ссылку или сам токен.");
                return;
            }
            await (0, shared_1.upsertVkAccessToken)(options.databaseUrl, {
                telegramUserId: userId,
                accessToken: parsedToken.accessToken,
                expiresAt: parsedToken.expiresAt
            });
            const packs = await (0, shared_1.listUserPacks)(options.databaseUrl, userId);
            options.state.setRedCommentsState(userId, {
                ...state,
                step: "await_links",
                vkAccessToken: parsedToken.accessToken
            });
            await showLinksPrompt(ctx, packs);
            return;
        }
        if (state.step === "await_links") {
            const resolveApi = options.vkApi ??
                (state.vkAccessToken
                    ? new vk_io_1.API({ token: state.vkAccessToken, apiVersion: options.apiVersion })
                    : null);
            const links = text
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            const parsed = await (0, parsePublicLinks_1.parsePublicLinks)(links, { vkApi: resolveApi });
            if (parsed.groupIds.length === 0) {
                const packs = await (0, shared_1.listUserPacks)(options.databaseUrl, userId);
                const keyboard = buildPacksKeyboard(packs);
                await ctx.reply([
                    "Не удалось обработать ни одной ссылки на сообщество.",
                    parsed.errors.length > 0 ? `Невалидные ссылки:\n${parsed.errors.join("\n")}` : "",
                    "Попробуйте снова или выберите пак:"
                ]
                    .filter(Boolean)
                    .join("\n\n"), keyboard ? { reply_markup: keyboard } : undefined);
                return;
            }
            options.state.setRedCommentsState(userId, {
                ...state,
                step: "await_post_fragment",
                groupIds: parsed.groupIds,
                skippedLinks: parsed.errors
            });
            await ctx.reply("Отправьте фрагмент текста поста (под такими постами будут редактироваться комментарии):");
            return;
        }
        if (state.step === "await_post_fragment") {
            const value = (0, textNormalize_1.normalizeText)(text);
            if (!value) {
                await ctx.reply("Фрагмент текста поста не может быть пустым. Отправьте снова:");
                return;
            }
            options.state.setRedCommentsState(userId, {
                ...state,
                step: "await_old_comment_fragment",
                postTextFragment: value
            });
            await ctx.reply("Отправьте фрагмент старого комментария, который нужно удалить:");
            return;
        }
        if (state.step === "await_old_comment_fragment") {
            const value = (0, textNormalize_1.normalizeText)(text);
            if (!value) {
                await ctx.reply("Фрагмент старого комментария не может быть пустым. Отправьте снова:");
                return;
            }
            options.state.setRedCommentsState(userId, {
                ...state,
                step: "await_new_comment_text",
                oldCommentFragment: value
            });
            await ctx.reply("Отправьте полный текст нового комментария:");
            return;
        }
        const newCommentText = (0, textNormalize_1.normalizeText)(text);
        if (!newCommentText) {
            await ctx.reply("Текст нового комментария не может быть пустым. Отправьте снова:");
            return;
        }
        const task = {
            taskId: (0, node_crypto_1.randomUUID)(),
            requestedBy: userId,
            groupIds: state.groupIds,
            postTextFragment: state.postTextFragment,
            oldCommentFragment: state.oldCommentFragment,
            newCommentText,
            vkAccessToken: state.vkAccessToken,
            createdAt: new Date().toISOString()
        };
        const jobsCount = await options.queueService.enqueueRedCommentsJobs(task);
        options.state.clearRedCommentsState(userId);
        options.logger.info({
            taskId: task.taskId,
            requestedBy: task.requestedBy,
            groups: task.groupIds.length
        }, "red_comments task queued");
        await ctx.reply([
            `Задача поставлена в очередь: taskId=${task.taskId}, сообществ=${jobsCount}`,
            state.skippedLinks.length > 0 ? `Пропущенные ссылки:\n${state.skippedLinks.join("\n")}` : ""
        ]
            .filter(Boolean)
            .join("\n\n"));
    });
}
//# sourceMappingURL=redComments.flow.js.map