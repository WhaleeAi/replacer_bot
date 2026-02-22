import type { API } from "vk-io";

export interface ParsePublicLinksResult {
  groupIds: number[];
  errors: string[];
}

interface ParsePublicLinksOptions {
  vkApi: API | null;
}

function normalizeToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const match = trimmed.match(/^(?:https?:\/\/)?(?:m\.)?vk\.(?:com|ru)\/([^/?#]+)/i);
  if (match?.[1]) {
    return match[1].trim();
  }
  return trimmed.replace(/^@/, "");
}

function extractDirectGroupId(token: string): number | null {
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

async function resolveScreenNameGroupId(vkApi: API | null, screenName: string): Promise<number | null> {
  if (!vkApi) {
    return null;
  }
  try {
    const resolved = (await vkApi.utils.resolveScreenName({
      screen_name: screenName
    })) as { type?: string; object_id?: number } | null;

    if (!resolved?.type || !resolved.object_id) {
      return null;
    }

    if (!["group", "page", "event"].includes(resolved.type)) {
      return null;
    }

    const id = Math.abs(Number(resolved.object_id));
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function parsePublicLinks(
  links: string[],
  options: ParsePublicLinksOptions
): Promise<ParsePublicLinksResult> {
  const groupIds = new Set<number>();
  const errors: string[] = [];

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
