import type { Bot, Context } from "grammy";
import type { Logger } from "pino";
import { parsePublicLinks } from "../utils/parsePublicLinks";
import { normalizeText } from "../utils/textNormalize";
import type { QueueService } from "../services/queue.service";
import type { API } from "vk-io";
import type { StateService } from "../services/state.service";
import { randomUUID } from "node:crypto";
import type { RedPostsTask } from "@vk-text-replacer/shared";

interface RedPostsFlowOptions {
  queueService: QueueService;
  logger: Logger;
  state: StateService;
  vkApi: API | null;
}

export function registerRedPostsFlow(bot: Bot<Context>, options: RedPostsFlowOptions): void {
  bot.command("red_posts", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }

    options.state.setRedPostsState(userId, {
      step: "await_links",
      rawLinks: [],
      groupIds: [],
      findText: "",
      skippedLinks: []
    });
    await ctx.reply("Введите ссылки на паблики, каждая с новой строки:");
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
