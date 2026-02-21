import type { Job } from "bullmq";
import type { VkRedPostJobPayload, VkRedPostJobResult, VkWallPost } from "@vk-text-replacer/shared";
import type { Logger } from "pino";
import type { VkService } from "../services/vk.service";
import type { ReplaceService } from "../services/replace.service";
import { buildAttachmentsParam } from "../utils/attachments";
import { getCutoffUnixTimestamp } from "../utils/cutoff";

interface ProcessGroupContext {
  logger: Logger;
  vkService: VkService;
  replaceService: ReplaceService;
}

const WALL_PAGE_SIZE = 100;

function shouldProcessPost(post: VkWallPost, cutoffTs: number): boolean {
  return Number(post.date) >= cutoffTs;
}

export async function processGroupJob(
  job: Job<VkRedPostJobPayload>,
  context: ProcessGroupContext
): Promise<VkRedPostJobResult> {
  const { taskId, groupId, findText, replaceText, cutoffDays, vkAccessToken } = job.data;
  const cutoffTs = getCutoffUnixTimestamp(cutoffDays);

  let checkedPosts = 0;
  let editedPosts = 0;
  let skippedPosts = 0;
  let errorsCount = 0;
  let offset = 0;
  let reachedOldPosts = false;

  while (!reachedOldPosts) {
    const posts = await context.vkService.getWallPostsPage(vkAccessToken, groupId, offset, WALL_PAGE_SIZE);
    if (posts.length === 0) {
      break;
    }

    for (const post of posts) {
      if (!shouldProcessPost(post, cutoffTs)) {
        reachedOldPosts = true;
        break;
      }

      checkedPosts += 1;
      const originalText = post.text ?? "";
      if (!context.replaceService.contains(originalText, findText)) {
        skippedPosts += 1;
        continue;
      }

      const newText = context.replaceService.replace(originalText, findText, replaceText);
      if (newText === originalText) {
        skippedPosts += 1;
        continue;
      }

      try {
        await context.vkService.editWallPost({
          vkAccessToken,
          groupId,
          postId: post.id,
          message: newText,
          attachments: buildAttachmentsParam(post.attachments)
        });
        editedPosts += 1;
        context.logger.info({ taskId, groupId, postId: post.id }, "Post edited");
      } catch (error) {
        errorsCount += 1;
        context.logger.error({ err: error, taskId, groupId, postId: post.id }, "Post edit failed");
      }
    }

    if (posts.length < WALL_PAGE_SIZE) {
      break;
    }
    offset += WALL_PAGE_SIZE;
  }

  const result: VkRedPostJobResult = {
    taskId,
    groupId,
    checkedPosts,
    editedPosts,
    skippedPosts,
    errorsCount
  };

  return result;
}
