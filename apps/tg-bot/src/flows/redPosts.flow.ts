import { InlineKeyboard, type Bot, type Context } from "grammy";
import { API } from "vk-io";
import type { Logger } from "pino";
import { parsePublicLinks } from "../utils/parsePublicLinks";
import { normalizeText } from "../utils/textNormalize";
import type { QueueService } from "../services/queue.service";
import type { StateService } from "../services/state.service";
import { randomUUID } from "node:crypto";
import type { RedPostsTask } from "@vk-text-replacer/shared";
import {
  getVkAccessTokenByTelegramUserId,
  getUserPackGroupIds,
  listUserPacks,
  type UserPackSummary,
  upsertVkAccessToken
} from "@vk-text-replacer/shared";

interface RedPostsFlowOptions {
  apiVersion: string;
  databaseUrl: string;
  queueService: QueueService;
  logger: Logger;
  state: StateService;
  vkApi: API | null;
}

interface ParsedVkTokenInput {
  accessToken: string;
  expiresAt: Date | null;
}

function parseVkTokenInput(raw: string): ParsedVkTokenInput | null {
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
  } catch {
    return null;
  }
}

function isRecentWithinOneHour(date: Date | null): boolean {
  if (!date) {
    return false;
  }
  return Date.now() - date.getTime() < 60 * 60 * 1000;
}

function buildPacksKeyboard(packs: UserPackSummary[]): InlineKeyboard | null {
  if (!packs.length) {
    return null;
  }

  const keyboard = new InlineKeyboard();
  for (const pack of packs) {
    keyboard.text(`${pack.name} (${pack.groupsCount})`, `pack:${pack.id}`).row();
  }
  return keyboard;
}

async function showLinksPrompt(ctx: Context, packs: UserPackSummary[]): Promise<void> {
  const keyboard = buildPacksKeyboard(packs);
  await ctx.reply(
    "Токен сохранен. Теперь отправьте ссылки на сообщества, по одной в строке, или выберите пак:",
    keyboard ? { reply_markup: keyboard } : undefined
  );
}

export function registerRedPostsFlow(bot: Bot<Context>, options: RedPostsFlowOptions): void {
  bot.command("red_posts", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }

    options.state.clearAddPackState(userId);
    options.state.clearPackEditState(userId);
    options.state.clearRedCommentsState(userId);

    const stored = await getVkAccessTokenByTelegramUserId(options.databaseUrl, userId);
    if (stored && isRecentWithinOneHour(stored.updatedAt)) {
      const packs = await listUserPacks(options.databaseUrl, userId);
      options.state.setRedPostsState(userId, {
        step: "await_links",
        rawLinks: [],
        groupIds: [],
        findText: "",
        vkAccessToken: stored.accessToken,
        skippedLinks: []
      });
      await showLinksPrompt(ctx, packs);
      return;
    }

    options.state.setRedPostsState(userId, {
      step: "await_token",
      rawLinks: [],
      groupIds: [],
      findText: "",
      vkAccessToken: "",
      skippedLinks: []
    });
    await ctx.reply(
      [
        "1) Перейдите на https://vkhost.github.io/",
        "2) Выберите VK Admin и нажмите кнопку для получения доступа",
        "3) Скопируйте адресную строку и отправьте сюда (https://oauth.vk.com/blank.html#access_token=... и тд)"
      ].join("\n")
    );
  });

  bot.command("cancel", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }
    options.state.clearRedPostsState(userId);
    options.state.clearAddPackState(userId);
    options.state.clearPackEditState(userId);
    options.state.clearRedCommentsState(userId);
    await ctx.reply("Current dialog canceled.");
  });

  bot.callbackQuery(/^pack:(\d+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const state = options.state.getRedPostsState(userId);
    if (!state || state.step !== "await_links") {
      await ctx.answerCallbackQuery({ text: "Start /red_posts first." });
      return;
    }

    const packId = Number(ctx.match?.[1]);
    if (!Number.isFinite(packId) || packId <= 0) {
      await ctx.answerCallbackQuery({ text: "Invalid pack." });
      return;
    }

    const groupIds = await getUserPackGroupIds(options.databaseUrl, userId, packId);
    if (!groupIds || groupIds.length === 0) {
      await ctx.answerCallbackQuery({ text: "Pack is empty or unavailable." });
      return;
    }

    options.state.setRedPostsState(userId, {
      ...state,
      step: "await_find",
      rawLinks: [],
      groupIds,
      skippedLinks: []
    });

    await ctx.answerCallbackQuery({ text: `Pack selected (${groupIds.length})` });
    await ctx.reply("Пак выбран. Теперь отправьте текст, который нужно заменить:");
  });

  bot.on("message:text", async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await next();
      return;
    }

    const state = options.state.getRedPostsState(userId);
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
        await ctx.reply("Could not parse access_token. Send full callback URL or raw token.");
        return;
      }

      await upsertVkAccessToken(options.databaseUrl, {
        telegramUserId: userId,
        accessToken: parsedToken.accessToken,
        expiresAt: parsedToken.expiresAt
      });

      const packs = await listUserPacks(options.databaseUrl, userId);
      options.state.setRedPostsState(userId, {
        ...state,
        step: "await_links",
        vkAccessToken: parsedToken.accessToken
      });
      await showLinksPrompt(ctx, packs);
      return;
    }

    if (state.step === "await_links") {
      const resolveApi =
        options.vkApi ??
        (state.vkAccessToken
          ? new API({ token: state.vkAccessToken, apiVersion: options.apiVersion })
          : null);
      const links = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const parsed = await parsePublicLinks(links, { vkApi: resolveApi });
      if (parsed.groupIds.length === 0) {
        const packs = await listUserPacks(options.databaseUrl, userId);
        const keyboard = buildPacksKeyboard(packs);
        await ctx.reply(
          [
            "Не смог найти валидные ссылки.",
            parsed.errors.length > 0 ? `Невалидные:\n${parsed.errors.join("\n")}` : "",
            "Попробуйте еще раз или выберите пак:"
          ]
            .filter(Boolean)
            .join("\n\n"),
          keyboard ? { reply_markup: keyboard } : undefined
        );
        return;
      }

      options.state.setRedPostsState(userId, {
        ...state,
        step: "await_find",
        rawLinks: links,
        groupIds: parsed.groupIds,
        skippedLinks: parsed.errors
      });

      await ctx.reply(
        parsed.errors.length > 0
          ? `Some links were skipped:\n${parsed.errors.join("\n")}\n\nТеперь отправьте текст для замены:`
          : "Теперь отправьте текст для замены:"
      );
      return;
    }

    if (state.step === "await_find") {
      const findText = normalizeText(text);
      if (!findText) {
        await ctx.reply("find text cannot be empty. Send text to find:");
        return;
      }

      options.state.setRedPostsState(userId, {
        ...state,
        step: "await_replace",
        findText
      });
      await ctx.reply("Now send replacement text:");
      return;
    }

    const replaceText = normalizeText(text);
    if (!replaceText) {
      await ctx.reply("replace text cannot be empty. Send replacement text:");
      return;
    }

    const task: RedPostsTask = {
      taskId: randomUUID(),
      requestedBy: userId,
      groupIds: state.groupIds,
      findText: state.findText,
      replaceText,
      cutoffDays: 4,
      vkAccessToken: state.vkAccessToken,
      createdAt: new Date().toISOString()
    };

    const jobsCount = await options.queueService.enqueueRedPostsJobs(task);
    options.state.clearRedPostsState(userId);

    options.logger.info(
      {
        taskId: task.taskId,
        requestedBy: task.requestedBy,
        groups: task.groupIds.length
      },
      "red_posts task queued"
    );

    await ctx.reply(
      [
        `Task queued: taskId=${task.taskId}, groups=${jobsCount}`,
        state.skippedLinks.length > 0 ? `Skipped links:\n${state.skippedLinks.join("\n")}` : ""
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  });
}
