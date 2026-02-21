"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDatabaseSchema = ensureDatabaseSchema;
exports.ensureUser = ensureUser;
exports.verifyUserPassword = verifyUserPassword;
exports.upsertVkAccessToken = upsertVkAccessToken;
exports.getVkAccessTokenByTelegramUserId = getVkAccessTokenByTelegramUserId;
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
    auth_password TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_password TEXT`,
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
async function verifyUserPassword(databaseUrl, telegramUserId, password) {
    return withClient(databaseUrl, async (client) => {
        const result = await client.query(`SELECT auth_password
       FROM users
       WHERE telegram_user_id = $1`, [telegramUserId]);
        const row = asRow(result.rows?.[0]);
        const stored = typeof row.auth_password === "string" ? row.auth_password : "";
        return stored.length > 0 && stored === password;
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
        const result = await client.query(`SELECT u.telegram_user_id, t.access_token, t.expires_at
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
            expiresAt: asDate(row.expires_at)
        };
    });
}
//# sourceMappingURL=db.js.map