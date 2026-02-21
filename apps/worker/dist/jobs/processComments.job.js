"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processCommentsJob = processCommentsJob;
const WALL_PAGE_SIZE = 100;
const COMMENTS_PAGE_SIZE = 100;
function containsText(input, fragment) {
    return Boolean(fragment) && input.includes(fragment);
}
async function processPostComments(vkService, vkAccessToken, groupId, postId, oldCommentFragment, newCommentText) {
    let replaced = false;
    let offset = 0;
    try {
        await vkService.openWallComments(vkAccessToken, groupId, postId);
    }
    catch {
        // continue anyway; comments may already be open
    }
    while (true) {
        const comments = await vkService.getWallCommentsPage(vkAccessToken, groupId, postId, offset, COMMENTS_PAGE_SIZE);
        if (comments.length === 0) {
            break;
        }
        for (const comment of comments) {
            const text = comment.text ?? "";
            if (!containsText(text, oldCommentFragment)) {
                continue;
            }
            await vkService.deleteWallComment(vkAccessToken, groupId, comment.id);
            replaced = true;
        }
        if (comments.length < COMMENTS_PAGE_SIZE) {
            break;
        }
        offset += COMMENTS_PAGE_SIZE;
    }
    if (replaced) {
        await vkService.createWallCommentFromGroup({
            vkAccessToken,
            groupId,
            postId,
            message: newCommentText
        });
    }
    try {
        await vkService.closeWallComments(vkAccessToken, groupId, postId);
    }
    catch {
        // do not fail whole post on close error
    }
    return replaced;
}
async function processCommentsJob(job, context) {
    const { taskId, groupId, postTextFragment, oldCommentFragment, newCommentText, vkAccessToken } = job.data;
    let checkedPosts = 0;
    let editedPosts = 0;
    let skippedPosts = 0;
    let errorsCount = 0;
    let offset = 0;
    while (true) {
        const posts = await context.vkService.getWallPostsPage(vkAccessToken, groupId, offset, WALL_PAGE_SIZE);
        if (posts.length === 0) {
            break;
        }
        for (const post of posts) {
            checkedPosts += 1;
            const postText = post.text ?? "";
            if (!containsText(postText, postTextFragment)) {
                skippedPosts += 1;
                continue;
            }
            try {
                const changed = await processPostComments(context.vkService, vkAccessToken, groupId, post.id, oldCommentFragment, newCommentText);
                if (changed) {
                    editedPosts += 1;
                    context.logger.info({ taskId, groupId, postId: post.id }, "Comments replaced under post");
                }
                else {
                    skippedPosts += 1;
                }
            }
            catch (error) {
                errorsCount += 1;
                context.logger.error({ err: error, taskId, groupId, postId: post.id }, "Comment replacement failed");
            }
        }
        if (posts.length < WALL_PAGE_SIZE) {
            break;
        }
        offset += WALL_PAGE_SIZE;
    }
    return {
        taskId,
        groupId,
        checkedPosts,
        editedPosts,
        skippedPosts,
        errorsCount
    };
}
//# sourceMappingURL=processComments.job.js.map