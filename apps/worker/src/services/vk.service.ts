import { API } from "vk-io";
import type { Logger } from "pino";
import type { RateLimitService } from "./rateLimit.service";
import type { VkWallAttachmentRef, VkWallPost } from "@vk-text-replacer/shared";

interface VkServiceOptions {
  apiVersion: string;
  logger: Logger;
  rateLimitService: RateLimitService;
}

export interface VkService {
  getWallPostsPage(vkAccessToken: string, groupId: number, offset: number, count: number): Promise<VkWallPost[]>;
  editWallPost(args: {
    vkAccessToken: string;
    groupId: number;
    postId: number;
    message: string;
    attachments?: string;
  }): Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toAttachmentRef(value: unknown): VkWallAttachmentRef | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    type?: unknown;
    owner_id?: unknown;
    id?: unknown;
    access_key?: unknown;
    [key: string]: unknown;
  };

  if (typeof candidate.type === "string") {
    const nestedByType = candidate[candidate.type];
    if (nestedByType && typeof nestedByType === "object") {
      const nested = nestedByType as {
        owner_id?: unknown;
        id?: unknown;
        access_key?: unknown;
      };
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

  for (const [type, raw] of Object.entries(candidate)) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const nested = raw as {
      owner_id?: unknown;
      id?: unknown;
      access_key?: unknown;
    };
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

function normalizePost(value: unknown): VkWallPost | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    id?: unknown;
    date?: unknown;
    text?: unknown;
    attachments?: unknown;
  };

  const id = toNumber(candidate.id);
  const date = toNumber(candidate.date);
  if (id === undefined || date === undefined) {
    return null;
  }

  const attachments = Array.isArray(candidate.attachments)
    ? candidate.attachments.map(toAttachmentRef).filter((item): item is VkWallAttachmentRef => item !== null)
    : undefined;

  return {
    id,
    date,
    text: typeof candidate.text === "string" ? candidate.text : "",
    attachments
  };
}

function isRetryableError(error: unknown): boolean {
  const candidate = error as {
    code?: number;
    status?: number;
    message?: string;
    name?: string;
  };

  if (candidate?.status === 429 || candidate?.code === 6 || candidate?.code === 9) {
    return true;
  }

  const message = String(candidate?.message ?? "").toLowerCase();
  const name = String(candidate?.name ?? "").toLowerCase();
  return (
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("network") ||
    name.includes("fetcherror")
  );
}

export function createVkService(options: VkServiceOptions): VkService {
  const apiByToken = new Map<string, API>();

  function getApiForToken(vkAccessToken: string): API {
    const cached = apiByToken.get(vkAccessToken);
    if (cached) {
      return cached;
    }

    const api = new API({
      token: vkAccessToken,
      apiVersion: options.apiVersion
    });
    apiByToken.set(vkAccessToken, api);
    return api;
  }

  async function callWithRetry<T>(
    vkAccessToken: string,
    groupId: number,
    operationName: string,
    fn: (api: API) => Promise<T>
  ): Promise<T> {
    let attempt = 0;
    const maxAttempts = 3;
    while (attempt < maxAttempts) {
      attempt += 1;
      await options.rateLimitService.wait();
      try {
        const api = getApiForToken(vkAccessToken);
        return await fn(api);
      } catch (error) {
        if (!isRetryableError(error) || attempt >= maxAttempts) {
          throw error;
        }
        const backoffMs = 300 * 2 ** (attempt - 1);
        options.logger.warn(
          { err: error, groupId, operationName, attempt, backoffMs },
          "Retryable VK error, backing off"
        );
        await sleep(backoffMs);
      }
    }

    throw new Error(`VK call failed after retries: ${operationName}`);
  }

  return {
    async getWallPostsPage(vkAccessToken: string, groupId: number, offset: number, count: number): Promise<VkWallPost[]> {
      const ownerId = -Math.abs(groupId);
      const response = await callWithRetry(vkAccessToken, groupId, "wall.get", (api) =>
        api.wall.get({
          owner_id: ownerId,
          offset,
          count
        })
      );
      const items = Array.isArray(response.items) ? response.items : [];
      return items.map(normalizePost).filter((post): post is VkWallPost => post !== null);
    },

    async editWallPost(args): Promise<void> {
      const ownerId = -Math.abs(args.groupId);
      await callWithRetry(args.vkAccessToken, args.groupId, "wall.edit", (api) =>
        api.wall.edit({
          owner_id: ownerId,
          post_id: args.postId,
          message: args.message,
          attachments: args.attachments
        })
      );
    }
  };
}
