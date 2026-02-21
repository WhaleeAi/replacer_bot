import type { Logger } from "pino";
export declare function ensureDatabaseSchema(databaseUrl: string, logger?: Logger): Promise<void>;
export declare function ensureUser(databaseUrl: string, telegramUserId: number): Promise<number>;
export declare function verifyUserPassword(databaseUrl: string, telegramUserId: number, password: string): Promise<boolean>;
export interface UpsertVkAccessTokenInput {
    telegramUserId: number;
    accessToken: string;
    expiresAt?: Date | null;
}
export interface VkAccessTokenRecord {
    telegramUserId: number;
    accessToken: string;
    expiresAt: Date | null;
}
export declare function upsertVkAccessToken(databaseUrl: string, input: UpsertVkAccessTokenInput): Promise<void>;
export declare function getVkAccessTokenByTelegramUserId(databaseUrl: string, telegramUserId: number): Promise<VkAccessTokenRecord | null>;
