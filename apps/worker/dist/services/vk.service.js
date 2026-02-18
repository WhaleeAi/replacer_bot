"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVkService = createVkService;
const vk_io_1 = require("vk-io");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function toAttachmentRef(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const candidate = value;
    if (typeof candidate.type === "string") {
        const nestedByType = candidate[candidate.type];
        if (nestedByType && typeof nestedByType === "object") {
            const nested = nestedByType;
            const nestedOwnerId = toNumber(nested.owner_id);
            const nestedId = toNumber(nested.id);
            if (nestedOwnerId !== undefined && nestedId !== undefined) {
                return {
                    type: candidate.type,
                    owner_id: nestedOwnerId,
                    id: nestedId,
                    access_key: typeof nested.access_key === "string" ? nested.access_key : undefined
                };
            }
        }
        return {
            type: candidate.type,
            owner_id: toNumber(candidate.owner_id),
            id: toNumber(candidate.id),
            access_key: typeof candidate.access_key === "string" ? candidate.access_key : undefined
        };
    }
    // vk-io wall attachment shape may keep ids inside nested typed object:
    // { photo: { owner_id, id, access_key } } etc.
    for (const [type, raw] of Object.entries(candidate)) {
        if (!raw || typeof raw !== "object") {
            continue;
        }
        const nested = raw;
        const ownerId = toNumber(nested.owner_id);
        const id = toNumber(nested.id);
        if (ownerId !== undefined && id !== undefined) {
            return {
                type,
                owner_id: ownerId,
                id,
                access_key: typeof nested.access_key === "string" ? nested.access_key : undefined
            };
        }
    }
    return null;
}
function normalizePost(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const candidate = value;
    const id = toNumber(candidate.id);
    const date = toNumber(candidate.date);
    if (id === undefined || date === undefined) {
        return null;
    }
    const attachments = Array.isArray(candidate.attachments)
        ? candidate.attachments.map(toAttachmentRef).filter((item) => item !== null)
        : undefined;
    return {
        id,
        date,
        text: typeof candidate.text === "string" ? candidate.text : "",
        attachments
    };
}
function isRetryableError(error) {
    const candidate = error;
    if (candidate?.status === 429 || candidate?.code === 6 || candidate?.code === 9) {
        return true;
    }
    const message = String(candidate?.message ?? "").toLowerCase();
    const name = String(candidate?.name ?? "").toLowerCase();
    return (message.includes("too many requests") ||
        message.includes("rate limit") ||
        message.includes("econnreset") ||
        message.includes("etimedout") ||
        message.includes("network") ||
        name.includes("fetcherror"));
}
function createVkService(options) {
    const apiByGroupId = new Map();
    for (const [groupIdRaw, token] of Object.entries(options.tokensByGroupId)) {
        const groupId = Number(groupIdRaw);
        if (!Number.isFinite(groupId) || groupId <= 0) {
            continue;
        }
        apiByGroupId.set(groupId, new vk_io_1.API({
            token,
            apiVersion: options.apiVersion
        }));
    }
    async function callWithRetry(groupId, operationName, fn) {
        const api = apiByGroupId.get(groupId);
        if (!api) {
            throw new Error(`VK token is missing for groupId=${groupId}`);
        }
        let attempt = 0;
        const maxAttempts = 3;
        while (attempt < maxAttempts) {
            attempt += 1;
            await options.rateLimitService.wait();
            try {
                return await fn(api);
            }
            catch (error) {
                if (!isRetryableError(error) || attempt >= maxAttempts) {
                    throw error;
                }
                const backoffMs = 300 * 2 ** (attempt - 1);
                options.logger.warn({ err: error, groupId, operationName, attempt, backoffMs }, "Retryable VK error, backing off");
                await sleep(backoffMs);
            }
        }
        throw new Error(`VK call failed after retries: ${operationName}`);
    }
    return {
        async getWallPostsPage(groupId, offset, count) {
            const ownerId = -Math.abs(groupId);
            const response = await callWithRetry(groupId, "wall.get", (api) => api.wall.get({
                owner_id: ownerId,
                offset,
                count
            }));
            const items = Array.isArray(response.items) ? response.items : [];
            return items.map(normalizePost).filter((post) => post !== null);
        },
        async editWallPost(args) {
            const ownerId = -Math.abs(args.groupId);
            await callWithRetry(args.groupId, "wall.edit", (api) => api.wall.edit({
                owner_id: ownerId,
                post_id: args.postId,
                message: args.message,
                attachments: args.attachments
            }));
        }
    };
}
//# sourceMappingURL=vk.service.js.map