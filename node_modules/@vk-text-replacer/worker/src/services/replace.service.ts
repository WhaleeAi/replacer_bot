export interface ReplaceService {
  replace(input: string, from: string, to: string): string;
  contains(input: string, findText: string): boolean;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildWholeMatchRegex(fragment: string): RegExp | null {
  if (!fragment) {
    return null;
  }

  const escaped = escapeRegex(fragment);
  // Match only when the full fragment is not glued to letters/digits/underscore.
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu");
}

export function createReplaceService(): ReplaceService {
  return {
    contains(input: string, findText: string): boolean {
      const pattern = buildWholeMatchRegex(findText);
      return pattern ? pattern.test(input) : false;
    },
    replace(input: string, from: string, to: string): string {
      const pattern = buildWholeMatchRegex(from);
      if (!pattern) {
        return input;
      }
      return input.replace(pattern, to);
    }
  };
}
