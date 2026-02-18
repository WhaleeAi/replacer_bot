"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePublicLinks = parsePublicLinks;
function normalizeToken(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return "";
    }
    const match = trimmed.match(/^(?:https?:\/\/)?(?:m\.)?vk\.com\/([^/?#]+)/i);
    if (match?.[1]) {
        return match[1].trim();
    }
    return trimmed.replace(/^@/, "");
}
function extractDirectGroupId(token) {
    const publicMatch = token.match(/^public(\d+)$/i);
    if (publicMatch?.[1]) {
        return Number(publicMatch[1]);
    }
    const clubMatch = token.match(/^club(\d+)$/i);
    if (clubMatch?.[1]) {
        return Number(clubMatch[1]);
    }
    return null;
}
async function resolveScreenNameGroupId(vkApi, screenName) {
    if (!vkApi) {
        return null;
    }
    try {
        const resolved = (await vkApi.utils.resolveScreenName({
            screen_name: screenName
        }));
        if (!resolved?.type || !resolved.object_id) {
            return null;
        }
        if (!["group", "page", "event"].includes(resolved.type)) {
            return null;
        }
        const id = Math.abs(Number(resolved.object_id));
        return Number.isFinite(id) && id > 0 ? id : null;
    }
    catch {
        return null;
    }
}
async function parsePublicLinks(links, options) {
    const groupIds = new Set();
    const errors = [];
    for (const source of links) {
        const token = normalizeToken(source);
        if (!token) {
            continue;
        }
        const directGroupId = extractDirectGroupId(token);
        if (directGroupId) {
            groupIds.add(directGroupId);
            continue;
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(token)) {
            errors.push(source);
            continue;
        }
        const resolvedGroupId = await resolveScreenNameGroupId(options.vkApi, token);
        if (!resolvedGroupId) {
            errors.push(source);
            continue;
        }
        groupIds.add(resolvedGroupId);
    }
    return {
        groupIds: [...groupIds],
        errors
    };
}
//# sourceMappingURL=parsePublicLinks.js.map