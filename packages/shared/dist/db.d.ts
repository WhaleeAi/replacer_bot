import type { Logger } from "pino";
export declare function ensureDatabaseSchema(databaseUrl: string, logger?: Logger): Promise<void>;
export declare function ensureUser(databaseUrl: string, telegramUserId: number): Promise<number>;
export declare function isUserRegistered(databaseUrl: string, telegramUserId: number): Promise<boolean>;
export interface UpsertVkAccessTokenInput {
    telegramUserId: number;
    accessToken: string;
    expiresAt?: Date | null;
}
export interface VkAccessTokenRecord {
    telegramUserId: number;
    accessToken: string;
    expiresAt: Date | null;
    updatedAt: Date | null;
}
export declare function upsertVkAccessToken(databaseUrl: string, input: UpsertVkAccessTokenInput): Promise<void>;
export declare function getVkAccessTokenByTelegramUserId(databaseUrl: string, telegramUserId: number): Promise<VkAccessTokenRecord | null>;
export interface UserPackSummary {
    id: number;
    name: string;
    groupsCount: number;
}
export declare function createUserPack(databaseUrl: string, telegramUserId: number, name: string, groupIds: number[]): Promise<number>;
export declare function listUserPacks(databaseUrl: string, telegramUserId: number): Promise<UserPackSummary[]>;
export declare function getUserPackGroupIds(databaseUrl: string, telegramUserId: number, packId: number): Promise<number[] | null>;
export declare function appendUserPackGroups(databaseUrl: string, telegramUserId: number, packId: number, groupIds: number[]): Promise<number | null>;
export declare function deleteUserPack(databaseUrl: string, telegramUserId: number, packId: number): Promise<boolean>;
