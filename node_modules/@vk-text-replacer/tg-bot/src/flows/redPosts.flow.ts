import type { Bot, Context } from "grammy";
import type { Logger } from "pino";
import { parsePublicLinks } from "../utils/parsePublicLinks";
import { normalizeText } from "../utils/textNormalize";
import type { QueueService } from "../services/queue.service";
import type { API } from "vk-io";
import type { StateService } from "../services/state.service";
import { randomUUID } from "node:crypto";
import type { RedPostsTask } from "@vk-text-replacer/shared";
import { upsertVkAccessToken } from "@vk-text-replacer/shared";

interface RedPostsFlowOptions {
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

export function registerRedPostsFlow(bot: Bot<Context>, options: RedPostsFlowOptions): void {
  bot.command("red_posts", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
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
        "1) Перейдите: https://vkhost.github.io/",
        "2) Выберите VK Admin и выдайте доступ",
        "3) Скопируйте адресную строку вида https://oauth.vk.com/blank.html#access_token=... и пришлите сюда"
      ].join("\n")
    );
  });

  bot.command("cancel", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }
    options.state.clearRedPostsState(userId);
    await ctx.reply("Текущий диалог отменен.");
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
        await ctx.reply(
          "Не удалось извлечь access_token. Пришлите полную ссылку из адресной строки после авторизации."
        );
        return;
      }

      await upsertVkAccessToken(options.databaseUrl, {
        telegramUserId: userId,
        accessToken: parsedToken.accessToken,
        expiresAt: parsedToken.expiresAt
      });

      options.state.setRedPostsState(userId, {
        ...state,
        step: "await_links",
        vkAccessToken: parsedToken.accessToken
      });
      await ctx.reply("Токен сохранен. Введите ссылки на паблики, каждая с новой строки:");
      return;
    }

    if (state.step === "await_links") {
      const links = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const parsed = await parsePublicLinks(links, { vkApi: options.vkApi });
      if (parsed.groupIds.length === 0) {
        await ctx.reply(
          [
            "Не удалось распознать ни одного паблика.",
            parsed.errors.length > 0 ? `Проблемные ссылки:\n${parsed.errors.join("\n")}` : "",
            "Введите ссылки повторно, каждая с новой строки:"
          ]
            .filter(Boolean)
            .join("\n\n")
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
          ? `Часть ссылок пропущена:\n${parsed.errors.join("\n")}\n\nВведите текст, который нужно заменить (find):`
          : "Введите текст, который нужно заменить (find):"
      );
      return;
    }

    if (state.step === "await_find") {
      const findText = normalizeText(text);
      if (!findText) {
        await ctx.reply("find не может быть пустым. Введите текст, который нужно заменить:");
        return;
      }

      options.state.setRedPostsState(userId, {
        ...state,
        step: "await_replace",
        findText
      });
      await ctx.reply("Введите текст, на который заменить (replace):");
      return;
    }

    const replaceText = normalizeText(text);
    if (!replaceText) {
      await ctx.reply("replace не может быть пустым. Введите текст, на который заменить:");
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
        `Задача принята: taskId=${task.taskId}, пабликов=${jobsCount}`,
        state.skippedLinks.length > 0 ? `Пропущенные ссылки:\n${state.skippedLinks.join("\n")}` : ""
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  });
}
