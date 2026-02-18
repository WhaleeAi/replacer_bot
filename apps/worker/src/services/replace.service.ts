export interface ReplaceService {
  replace(input: string, from: string, to: string): string;
  contains(input: string, findText: string): boolean;
}

export function createReplaceService(): ReplaceService {
  return {
    contains(input: string, findText: string): boolean {
      return Boolean(findText) && input.includes(findText);
    },
    replace(input: string, from: string, to: string): string {
      if (!from) {
        return input;
      }
      return input.split(from).join(to);
    }
  };
}
