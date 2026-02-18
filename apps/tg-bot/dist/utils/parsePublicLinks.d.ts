import type { API } from "vk-io";
export interface ParsePublicLinksResult {
    groupIds: number[];
    errors: string[];
}
interface ParsePublicLinksOptions {
    vkApi: API | null;
}
export declare function parsePublicLinks(links: string[], options: ParsePublicLinksOptions): Promise<ParsePublicLinksResult>;
export {};
