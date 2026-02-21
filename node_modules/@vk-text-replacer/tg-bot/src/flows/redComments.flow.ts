import { InlineKeyboard, type Bot, type Context } from "grammy";
import type { Logger } from "pino";
import type { API } from "vk-io";
import { randomUUID } from "node:crypto";
import {
  getVkAccessTokenByTelegramUserId,
  getUserPackGroupIds,
  listUserPacks,
  type RedCommentsTask,
  type UserPackSummary,
  upsertVkAccessToken
} from "@vk-text-replacer/shared";
import type { QueueService } from "../services/queue.service";
import type { StateService } from "../services/state.service";
import { parsePublicLinks } from "../utils/parsePublicLinks";
import { normalizeText } from "../utils/textNormalize";

interface RedCommentsFlowOptions {
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
    keyboard.text(`${pack.name} (${pack.groupsCount})`, `cpack:${pack.id}`).row();
  }
  return keyboard;
}

async function showLinksPrompt(ctx: Context, packs: UserPackSummary[]): Promise<void> {
  const keyboard = buildPacksKeyboard(packs);
  await ctx.reply(
    "Send community links (one per line) or select pack below:",
    keyboard ? { reply_markup: keyboard } : undefined
  );
}

export function registerRedCommentsFlow(bot: Bot<Context>, options: RedCommentsFlowOptions): void {
  bot.command("red_comments", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }

    options.state.clearRedPostsState(userId);
    options.state.clearAddPackState(userId);

    const stored = await getVkAccessTokenByTelegramUserId(options.databaseUrl, userId);
    if (stored && isRecentWithinOneHour(stored.updatedAt)) {
      const packs = await listUserPacks(options.databaseUrl, userId);
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

    await ctx.reply(
      [
        "1) Open: https://vkhost.github.io/",
        "2) Select VK Admin and grant access",
        "3) Send full URL like https://oauth.vk.com/blank.html#access_token=..."
      ].join("\n")
    );
  });

  bot.callbackQuery(/^cpack:(\d+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const state = options.state.getRedCommentsState(userId);
    if (!state || state.step !== "await_links") {
      await ctx.answerCallbackQuery({ text: "Start /red_comments first." });
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

    options.state.setRedCommentsState(userId, {
      ...state,
      step: "await_post_fragment",
      groupIds,
      skippedLinks: []
    });

    await ctx.answerCallbackQuery({ text: `Pack selected (${groupIds.length})` });
    await ctx.reply("Send fragment of post text (we will process comments under matching posts):");
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
        await ctx.reply("Could not parse access token. Send full callback URL or raw token.");
        return;
      }

      await upsertVkAccessToken(options.databaseUrl, {
        telegramUserId: userId,
        accessToken: parsedToken.accessToken,
        expiresAt: parsedToken.expiresAt
      });

      const packs = await listUserPacks(options.databaseUrl, userId);
      options.state.setRedCommentsState(userId, {
        ...state,
        step: "await_links",
        vkAccessToken: parsedToken.accessToken
      });
      await showLinksPrompt(ctx, packs);
      return;
    }

    if (state.step === "await_links") {
      const links = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const parsed = await parsePublicLinks(links, { vkApi: options.vkApi });
      if (parsed.groupIds.length === 0) {
        const packs = await listUserPacks(options.databaseUrl, userId);
        const keyboard = buildPacksKeyboard(packs);
        await ctx.reply(
          [
            "Could not resolve any community link.",
            parsed.errors.length > 0 ? `Invalid links:\n${parsed.errors.join("\n")}` : "",
            "Try again or select pack:"
          ]
            .filter(Boolean)
            .join("\n\n"),
          keyboard ? { reply_markup: keyboard } : undefined
        );
        return;
      }

      options.state.setRedCommentsState(userId, {
        ...state,
        step: "await_post_fragment",
        groupIds: parsed.groupIds,
        skippedLinks: parsed.errors
      });
      await ctx.reply("Send fragment of post text (we will process comments under matching posts):");
      return;
    }

    if (state.step === "await_post_fragment") {
      const value = normalizeText(text);
      if (!value) {
        await ctx.reply("Post text fragment cannot be empty. Send again:");
        return;
      }

      options.state.setRedCommentsState(userId, {
        ...state,
        step: "await_old_comment_fragment",
        postTextFragment: value
      });
      await ctx.reply("Send fragment of old comment to delete:");
      return;
    }

    if (state.step === "await_old_comment_fragment") {
      const value = normalizeText(text);
      if (!value) {
        await ctx.reply("Old comment fragment cannot be empty. Send again:");
        return;
      }

      options.state.setRedCommentsState(userId, {
        ...state,
        step: "await_new_comment_text",
        oldCommentFragment: value
      });
      await ctx.reply("Send full new comment text:");
      return;
    }

    const newCommentText = normalizeText(text);
    if (!newCommentText) {
      await ctx.reply("New comment text cannot be empty. Send again:");
      return;
    }

    const task: RedCommentsTask = {
      taskId: randomUUID(),
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

    options.logger.info(
      {
        taskId: task.taskId,
        requestedBy: task.requestedBy,
        groups: task.groupIds.length
      },
      "red_comments task queued"
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
