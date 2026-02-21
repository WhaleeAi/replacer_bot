"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processGroupJob = processGroupJob;
const attachments_1 = require("../utils/attachments");
const cutoff_1 = require("../utils/cutoff");
const WALL_PAGE_SIZE = 100;
function shouldProcessPost(post, cutoffTs) {
    return Number(post.date) >= cutoffTs;
}
async function processGroupJob(job, context) {
    const { taskId, groupId, findText, replaceText, cutoffDays, vkAccessToken } = job.data;
    const cutoffTs = (0, cutoff_1.getCutoffUnixTimestamp)(cutoffDays);
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
                    attachments: (0, attachments_1.buildAttachmentsParam)(post.attachments)
                });
                editedPosts += 1;
                context.logger.info({ taskId, groupId, postId: post.id }, "Post edited");
            }
            catch (error) {
                errorsCount += 1;
                context.logger.error({ err: error, taskId, groupId, postId: post.id }, "Post edit failed");
            }
        }
        if (posts.length < WALL_PAGE_SIZE) {
            break;
        }
        offset += WALL_PAGE_SIZE;
    }
    const result = {
        taskId,
        groupId,
        checkedPosts,
        editedPosts,
        skippedPosts,
        errorsCount
    };
    return result;
}
//# sourceMappingURL=processGroup.job.js.map