export interface ReplaceService {
    replace(input: string, from: string, to: string): string;
    contains(input: string, findText: string): boolean;
}
export declare function createReplaceService(): ReplaceService;
