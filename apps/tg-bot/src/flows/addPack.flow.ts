import type { Bot, Context } from "grammy";
import type { Logger } from "pino";
import type { API } from "vk-io";
import { createUserPack } from "@vk-text-replacer/shared";
import { parsePublicLinks } from "../utils/parsePublicLinks";
import type { StateService } from "../services/state.service";

interface AddPackFlowOptions {
  databaseUrl: string;
  logger: Logger;
  state: StateService;
  vkApi: API | null;
}

export function registerAddPackFlow(bot: Bot<Context>, options: AddPackFlowOptions): void {
  bot.command("add_pack", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }

    options.state.clearRedPostsState(userId);
    options.state.clearRedCommentsState(userId);
    options.state.setAddPackState(userId, {
      step: "await_name",
      name: ""
    });

    await ctx.reply("Send pack name:");
  });

  bot.on("message:text", async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await next();
      return;
    }

    const state = options.state.getAddPackState(userId);
    if (!state) {
      await next();
      return;
    }

    const text = (ctx.message.text ?? "").trim();
    if (!text || text.startsWith("/")) {
      await next();
      return;
    }

    if (state.step === "await_name") {
      if (text.length > 100) {
        await ctx.reply("Pack name is too long (max 100 chars). Send another name:");
        return;
      }

      options.state.setAddPackState(userId, {
        step: "await_links",
        name: text
      });
      await ctx.reply("Now send public links, one per line:");
      return;
    }

    const links = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed = await parsePublicLinks(links, { vkApi: options.vkApi });
    if (parsed.groupIds.length === 0) {
      await ctx.reply(
        [
          "No valid public links found.",
          parsed.errors.length > 0 ? `Invalid links:\n${parsed.errors.join("\n")}` : "",
          "Send links again, one per line:"
        ]
          .filter(Boolean)
          .join("\n\n")
      );
      return;
    }

    try {
      const packId = await createUserPack(options.databaseUrl, userId, state.name, parsed.groupIds);
      options.state.clearAddPackState(userId);
      options.logger.info(
        { userId, packId, packName: state.name, groupsCount: parsed.groupIds.length },
        "Pack created"
      );
      await ctx.reply(
        [
          `Pack created: ${state.name}`,
          `Pack id: ${packId}`,
          `Groups: ${parsed.groupIds.length}`,
          parsed.errors.length > 0 ? `Skipped links:\n${parsed.errors.join("\n")}` : ""
        ]
          .filter(Boolean)
          .join("\n\n")
      );
    } catch (error) {
      options.logger.error({ err: error, userId, packName: state.name }, "Pack create failed");
      await ctx.reply("Failed to create pack. If pack name already exists, choose another name.");
    }
  });
}
