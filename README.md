# vk-text-replacer-bot

Working monorepo prototype on Node.js + TypeScript:
- Telegram bot (`apps/tg-bot`) with `grammY`
- Worker (`apps/worker`) with `BullMQ` + `Redis` + `vk-io`
- Shared package (`packages/shared`) for types, env, logger, and DB schema init

PostgreSQL is used for persistent app data (`users`, `vk_tokens`, `user_packs`, `user_pack_groups`).
Queue state is stored in Redis.

## Requirements

- Node.js 20+
- npm 10+
- Docker + Docker Compose (for Postgres, Redis, and containerized services)

## Local quick start

1. Create `.env` from example:
   - `cp .env.example .env` (Linux/macOS)
   - `copy .env.example .env` (Windows CMD) or `Copy-Item .env.example .env` (PowerShell)
2. Install dependencies:
   - `npm install`
3. Run in development mode:
   - `npm run dev`
4. Build:
   - `npm run build`
5. Run built version:
   - `npm run start`

## Run with Docker Compose

1. Prepare `.env` next to `docker-compose.yml`.
2. Start services:
   - `docker compose up`

Services:
- `postgres`
- `redis`
- `tg-bot`
- `worker`

## Environment variables

- `TG_BOT_TOKEN` - Telegram bot token from BotFather.
- `ADMIN_KEY` - access key for new user auth in bot.
- `DATABASE_URL` - PostgreSQL URL, for example `postgres://postgres:postgres@localhost:5432/replacer_bot`.
- `REDIS_URL` - Redis URL, for example `redis://redis:6379`.
- `VK_TOKENS_JSON` - JSON map: `group_id -> user access token`.
  - Example: `{"123456789":"vk1.a.xxxxx","987654321":"vk1.a.yyyyy"}`
- `VK_API_VERSION` - VK API version, for example `5.131`.
- `WORKER_CONCURRENCY` - worker concurrency, for example `3`.
- `VK_RPS` - VK API requests per second limit, for example `3`.

## How to get VK tokens (high level)

1. Authorize a VK user who is admin in target communities.
2. Obtain a user token with required scopes (`wall`, `groups`, and optional `offline`).
3. Put token into `VK_TOKENS_JSON`, where key is `group_id` and value is token.

## What this prototype already includes

- npm workspaces monorepo scaffold
- Telegram flow stubs (`auth`, `redPosts`)
- BullMQ queue between bot and worker
- Stub services for VK, rate limiting, and text replacement
- `pino` logging

Next step: implement real auth, VK posts parsing/editing, replacement logic, and Telegram progress reporting.
