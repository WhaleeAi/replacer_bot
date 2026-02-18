import type { Logger } from "pino";

interface Queryable {
  connect(): Promise<void>;
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
}

function createPgClient(databaseUrl: string): Queryable {
  try {
    const { Client } = require("pg") as {
      Client: new (args: { connectionString: string }) => Queryable;
    };
    return new Client({ connectionString: databaseUrl });
  } catch {
    throw new Error("PostgreSQL driver is missing. Install it with: npm install --workspace packages/shared pg");
  }
}

const SCHEMA_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL UNIQUE,
    vk_user_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS vk_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scope TEXT,
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

export async function ensureDatabaseSchema(databaseUrl: string, logger?: Logger): Promise<void> {
  const client = createPgClient(databaseUrl);
  await client.connect();
  try {
    for (const sql of SCHEMA_SQL) {
      await client.query(sql);
    }
    logger?.info("PostgreSQL schema is ready");
  } finally {
    await client.end();
  }
}
