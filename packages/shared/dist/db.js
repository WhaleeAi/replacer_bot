"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDatabaseSchema = ensureDatabaseSchema;
exports.ensureUser = ensureUser;
exports.isUserRegistered = isUserRegistered;
exports.upsertVkAccessToken = upsertVkAccessToken;
exports.getVkAccessTokenByTelegramUserId = getVkAccessTokenByTelegramUserId;
exports.createUserPack = createUserPack;
exports.listUserPacks = listUserPacks;
exports.getUserPackGroupIds = getUserPackGroupIds;
exports.appendUserPackGroups = appendUserPackGroups;
exports.deleteUserPack = deleteUserPack;
function createPgClient(databaseUrl) {
    try {
        const { Client } = require("pg");
        return new Client({ connectionString: databaseUrl });
    }
    catch {
        throw new Error("PostgreSQL driver is missing. Install it with: npm install --workspace packages/shared pg");
    }
}
const SCHEMA_SQL = [
    `CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL UNIQUE,
    vk_user_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
    `ALTER TABLE users DROP COLUMN IF EXISTS auth_password`,
    `ALTER TABLE users DROP COLUMN IF EXISTS auth_granted`,
    `CREATE TABLE IF NOT EXISTS vk_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
    `CREATE TABLE IF NOT EXISTS user_packs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
  )`,
    `CREATE TABLE IF NOT EXISTS user_pack_groups (
    pack_id BIGINT NOT NULL REFERENCES user_packs(id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (pack_id, group_id)
  )`,
    `CREATE INDEX IF NOT EXISTS idx_user_packs_user_id ON user_packs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_pack_groups_group_id ON user_pack_groups(group_id)`
];
async function ensureDatabaseSchema(databaseUrl, logger) {
    const client = createPgClient(databaseUrl);
    await client.connect();
    try {
        for (const sql of SCHEMA_SQL) {
            await client.query(sql);
        }
        logger?.info("PostgreSQL schema is ready");
    }
    finally {
        await client.end();
    }
}
async function withClient(databaseUrl, fn) {
    const client = createPgClient(databaseUrl);
    await client.connect();
    try {
        return await fn(client);
    }
    finally {
        await client.end();
    }
}
function asRow(value) {
    return (value ?? {});
}
async function ensureUser(databaseUrl, telegramUserId) {
    return withClient(databaseUrl, async (client) => {
        return ensureUserWithClient(client, telegramUserId);
    });
}
async function ensureUserWithClient(client, telegramUserId) {
    await client.query(`INSERT INTO users (telegram_user_id)
     VALUES ($1)
     ON CONFLICT (telegram_user_id)
     DO UPDATE SET updated_at = NOW()`, [telegramUserId]);
    const result = await client.query(`SELECT id FROM users WHERE telegram_user_id = $1`, [telegramUserId]);
    const row = asRow(result.rows?.[0]);
    const userId = Number(row.id);
    if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error(`Failed to resolve user id for telegramUserId=${telegramUserId}`);
    }
    return userId;
}
async function isUserRegistered(databaseUrl, telegramUserId) {
    return withClient(databaseUrl, async (client) => {
        const result = await client.query(`SELECT 1 FROM users WHERE telegram_user_id = $1`, [telegramUserId]);
        return (result.rows ?? []).length > 0;
    });
}
function asDate(value) {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}
async function upsertVkAccessToken(databaseUrl, input) {
    await withClient(databaseUrl, async (client) => {
        const userId = await ensureUserWithClient(client, input.telegramUserId);
        await client.query(`INSERT INTO vk_tokens (user_id, access_token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`, [userId, input.accessToken, input.expiresAt ?? null]);
    });
}
async function getVkAccessTokenByTelegramUserId(databaseUrl, telegramUserId) {
    return withClient(databaseUrl, async (client) => {
        const result = await client.query(`SELECT u.telegram_user_id, t.access_token, t.expires_at, t.updated_at
       FROM users u
       INNER JOIN vk_tokens t ON t.user_id = u.id
       WHERE u.telegram_user_id = $1`, [telegramUserId]);
        const row = asRow(result.rows?.[0]);
        const accessToken = typeof row.access_token === "string" ? row.access_token : "";
        if (!accessToken) {
            return null;
        }
        return {
            telegramUserId: Number(row.telegram_user_id),
            accessToken,
            expiresAt: asDate(row.expires_at),
            updatedAt: asDate(row.updated_at)
        };
    });
}
async function createUserPack(databaseUrl, telegramUserId, name, groupIds) {
    return withClient(databaseUrl, async (client) => {
        const userId = await ensureUserWithClient(client, telegramUserId);
        const insertPack = await client.query(`INSERT INTO user_packs (user_id, name)
       VALUES ($1, $2)
       RETURNING id`, [userId, name]);
        const packRow = asRow(insertPack.rows?.[0]);
        const packId = Number(packRow.id);
        if (!Number.isFinite(packId) || packId <= 0) {
            throw new Error("Failed to create pack");
        }
        const uniqueGroupIds = [...new Set(groupIds.map((id) => Math.abs(Number(id))).filter((id) => id > 0))];
        for (const groupId of uniqueGroupIds) {
            await client.query(`INSERT INTO user_pack_groups (pack_id, group_id)
         VALUES ($1, $2)
         ON CONFLICT (pack_id, group_id) DO NOTHING`, [packId, groupId]);
        }
        return packId;
    });
}
async function listUserPacks(databaseUrl, telegramUserId) {
    return withClient(databaseUrl, async (client) => {
        const result = await client.query(`SELECT p.id, p.name, COUNT(g.group_id) AS groups_count
       FROM users u
       INNER JOIN user_packs p ON p.user_id = u.id
       LEFT JOIN user_pack_groups g ON g.pack_id = p.id
       WHERE u.telegram_user_id = $1
       GROUP BY p.id, p.name
       ORDER BY p.created_at DESC`, [telegramUserId]);
        return (result.rows ?? []).map((raw) => {
            const row = asRow(raw);
            return {
                id: Number(row.id),
                name: String(row.name ?? ""),
                groupsCount: Number(row.groups_count ?? 0)
            };
        });
    });
}
async function getUserPackGroupIds(databaseUrl, telegramUserId, packId) {
    return withClient(databaseUrl, async (client) => {
        const access = await client.query(`SELECT p.id
       FROM users u
       INNER JOIN user_packs p ON p.user_id = u.id
       WHERE u.telegram_user_id = $1 AND p.id = $2`, [telegramUserId, packId]);
        if (!(access.rows ?? []).length) {
            return null;
        }
        const groups = await client.query(`SELECT group_id
       FROM user_pack_groups
       WHERE pack_id = $1
       ORDER BY group_id`, [packId]);
        return (groups.rows ?? [])
            .map((raw) => Number(asRow(raw).group_id))
            .filter((id) => Number.isFinite(id) && id > 0);
    });
}
async function appendUserPackGroups(databaseUrl, telegramUserId, packId, groupIds) {
    return withClient(databaseUrl, async (client) => {
        const access = await client.query(`SELECT p.id
       FROM users u
       INNER JOIN user_packs p ON p.user_id = u.id
       WHERE u.telegram_user_id = $1 AND p.id = $2`, [telegramUserId, packId]);
        if (!(access.rows ?? []).length) {
            return null;
        }
        let inserted = 0;
        const uniqueGroupIds = [...new Set(groupIds.map((id) => Math.abs(Number(id))).filter((id) => id > 0))];
        for (const groupId of uniqueGroupIds) {
            const result = await client.query(`INSERT INTO user_pack_groups (pack_id, group_id)
         VALUES ($1, $2)
         ON CONFLICT (pack_id, group_id) DO NOTHING
         RETURNING group_id`, [packId, groupId]);
            if ((result.rows ?? []).length > 0) {
                inserted += 1;
            }
        }
        return inserted;
    });
}
async function deleteUserPack(databaseUrl, telegramUserId, packId) {
    return withClient(databaseUrl, async (client) => {
        const result = await client.query(`DELETE FROM user_packs p
       USING users u
       WHERE p.user_id = u.id
         AND u.telegram_user_id = $1
         AND p.id = $2
       RETURNING p.id`, [telegramUserId, packId]);
        return (result.rows ?? []).length > 0;
    });
}
//# sourceMappingURL=db.js.map