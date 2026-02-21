# vk-text-replacer-bot

Working monorepo prototype on Node.js + TypeScript:
- Telegram bot (`apps/tg-bot`) with `grammY`
- Worker (`apps/worker`) with `BullMQ` + `Redis` + `vk-io`
- Shared package (`packages/shared`) for types, env, logger, and DB schema init

PostgreSQL is used for persistent app data (`users`, `user_packs`, `user_pack_groups`).
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
- `ADMIN_TG_USER_ID` - Telegram user id of admin who approves access requests.
- `DATABASE_URL` - PostgreSQL URL, for example `postgres://postgres:postgres@localhost:5432/replacer_bot`.
- `REDIS_URL` - Redis URL, for example `redis://redis:6379`.
- `VK_API_VERSION` - VK API version, for example `5.131`.
- `WORKER_CONCURRENCY` - worker concurrency, for example `3`.
- `VK_RPS` - VK API requests per second limit, for example `3`.

User authorization is granted by admin approval. Bot checks access by presence of `telegram_user_id` in `users`.

## What this prototype already includes

- npm workspaces monorepo scaffold
- Telegram flows (`auth`, `redPosts`)
- BullMQ queue between bot and worker
- Stub services for VK, rate limiting, and text replacement
- `pino` logging

Next step: implement real auth, VK posts parsing/editing, replacement logic, and Telegram progress reporting.
