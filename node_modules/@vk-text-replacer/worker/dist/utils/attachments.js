"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAttachmentsParam = buildAttachmentsParam;
function toAttachmentToken(attachment) {
    if (!attachment.type || typeof attachment.type !== "string") {
        return null;
    }
    const ownerId = attachment.owner_id;
    const id = attachment.id;
    if (!Number.isFinite(ownerId) || !Number.isFinite(id)) {
        return null;
    }
    const accessKeySuffix = attachment.access_key ? `_${attachment.access_key}` : "";
    return `${attachment.type}${ownerId}_${id}${accessKeySuffix}`;
}
function buildAttachmentsParam(attachments) {
    if (!attachments || attachments.length === 0) {
        return undefined;
    }
    const tokens = attachments.map(toAttachmentToken).filter((token) => Boolean(token));
    return tokens.length > 0 ? tokens.join(",") : undefined;
}
//# sourceMappingURL=attachments.js.map