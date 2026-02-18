import type { VkWallAttachmentRef } from "@vk-text-replacer/shared";

function toAttachmentToken(attachment: VkWallAttachmentRef): string | null {
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

export function buildAttachmentsParam(attachments: VkWallAttachmentRef[] | undefined): string | undefined {
  if (!attachments || attachments.length === 0) {
    return undefined;
  }

  const tokens = attachments.map(toAttachmentToken).filter((token): token is string => Boolean(token));
  return tokens.length > 0 ? tokens.join(",") : undefined;
}
