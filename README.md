# Hotel Chaos Simulator

Monorepo for the Hotel Chaos Simulator MVP: Vite + React web app and Express API on Railway.

## Prerequisites

- Node.js **20+** (see root `package.json` `engines`)
- npm (workspaces)

## Local development

```bash
npm install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

npm run dev
```

| App | URL | Package |
|-----|-----|---------|
| Web | http://localhost:5173 | `apps/web` |
| API | http://localhost:3001 | `apps/api` |

Health check: `curl http://localhost:3001/health` (M3: `"database"` and `"auditDatabase"` when Postgres instances are reachable).

Build shared once before first web dev (or after changing `packages/shared`):

```bash
npm run build -w @hotel-chaos/shared
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Web + API together (concurrently) |
| `npm run build` | Build all workspaces |
| `npm run build:api` | Build shared + API only (Railway deploy) |
| `npm run db:migrate` | Apply primary SQL migrations in `apps/api/db/migrations/` |
| `npm run db:migrate:audit` | Apply audit SQL migrations in `apps/api/db/audit-migrations/` |
| `npm run typecheck` | Typecheck all workspaces |

Environment: [`.env.example`](.env.example) (full list). API → `parseEnv()` via `apps/api/src/env.ts`; web → `import.meta.env.VITE_*` only.

## Milestone 2 — normal booking flow

Use the **Railway primary Postgres** for local dev and deployed API (no Docker Postgres).

1. **API database URL** — In Railway → **Postgres** → Variables, copy **`DATABASE_PUBLIC_URL`** (local laptop) into `apps/api/.env` as **`DATABASE_URL`**. See [`apps/api/.env.example`](apps/api/.env.example). The API **will not start** without it.

2. **Migrations** (once per environment):

   ```bash
   npm run db:migrate
   ```

3. **Dev** — `npm run dev` → booking form at http://localhost:5173, API on http://localhost:3001. Set `VITE_API_URL=http://localhost:3001` in `apps/web/.env`.

### Local API smoke tests

```bash
API=http://localhost:3001

curl -s "$API/health" | jq .

curl -s -X POST "$API/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "guestName": "Hawi Odhiambo",
    "email": "hawi@example.com",
    "roomId": "101",
    "checkIn": "2026-09-01",
    "checkOut": "2026-09-03"
  }' | jq .

curl -s "$API/bookings/BK-xxxx" | jq .
# replace BK-xxxx with bookingId from POST response
```

## Milestone 3 — audit event system

Use a **second Railway Postgres** for audit events. The API writes an ordered trail on every `POST /bookings` and can still write to audit when the primary DB is down.

1. **Audit database URL** — Railway → **audit Postgres** service → Variables → copy **`DATABASE_PUBLIC_URL`** into `apps/api/.env` as **`AUDIT_DATABASE_URL`**. The API **will not start** without it (same as `DATABASE_URL`).

2. **Audit migrations** (once per environment):

   ```bash
   npm run db:migrate:audit
   ```

3. **Verify trail** — create a booking and fetch events by `X-Request-ID`:

   ```bash
   API=http://localhost:3001

   curl -si -X POST "$API/bookings" \
     -H "Content-Type: application/json" \
     -d '{
       "guestName": "Hawi Odhiambo",
       "email": "hawi@example.com",
       "roomId": "101",
       "checkIn": "2026-09-01",
       "checkOut": "2026-09-03"
     }' | tee /tmp/booking-response.txt

   REQ=$(grep -i '^x-request-id:' /tmp/booking-response.txt | awk '{print $2}' | tr -d '\r')
   curl -s "$API/audit/events?requestId=$REQ" | jq .
   ```

   Expect four events in order: `REQUEST_RECEIVED` → `VALIDATION_PASSED` → `BOOKING_ATTEMPTED` → `BOOKING_CREATED`.

See [`IMPLEMENTATION_MILESTONE_3.md`](IMPLEMENTATION_MILESTONE_3.md) and [`docs/railway.md`](docs/railway.md) (Milestone 3 section).

## Railway

M1: **booking-api** on Railway + **Postgres** in the same project. **M2:** primary Postgres + bookings. **M3:** second Postgres for audit + `AUDIT_DATABASE_URL` on **booking-api**.

**Full checklist, tokens, troubleshooting:** [`docs/railway.md`](docs/railway.md)

```bash
# CLI (global or npx)
npx @railway/cli login
npx @railway/cli link    # choose booking-api, not Postgres
npx @railway/cli up
```

On **booking-api**, set `NIXPACKS_NODE_VERSION=20` (or `22`) and `WEB_ORIGIN=http://localhost:5173`.

Verify deployed API:

```bash
curl -s "https://booking-api-production-25be.up.railway.app/health"
```

## Repo layout

```text
apps/web/                 Vite + React + React Router v7
apps/api/                 Express 5 API
packages/shared/          Shared Zod schemas, env, booking types
packages/railway-client/  Placeholder (Milestone 4)
railway.json              API deploy config (root)
docs/railway.md           Project/service IDs and Railway steps
```

See [`plan.md`](plan.md) and [`IMPLEMENTATION.md`](IMPLEMENTATION.md) for milestone scope.

## Milestone 1 verification

| Check | How |
|-------|-----|
| Install | `npm install` at repo root |
| Dev | `npm run dev` → web `5173`, api `3001` |
| Web→API | Home page shows API/database health badges |
| Types | `npm run typecheck` |
| Railway | Public `/health` 200 (URL in `docs/railway.md`) |
| Postgres | Provisioned in Railway project |
| Docs | IDs + token location in `docs/railway.md` |

## Milestone 2 verification

| Check | How |
|-------|-----|
| `DATABASE_URL` | Set in `apps/api/.env` (Railway Postgres) |
| Migrate | `npm run db:migrate` succeeds |
| Health | `GET /health` → `"database":"up"` when DB reachable |
| Book | `POST /bookings` → 201 + `bookingId`; web success state |
| Fetch | `GET /bookings/BK-xxxx` and details page |
| Validation | Invalid form → 400 / inline errors |
| Infra | Bad DB URL → `database:"down"` on health; POST → 503 on connection errors where mapped |

## Milestone 3 verification

| Check | How |
|-------|-----|
| `AUDIT_DATABASE_URL` | Set in `apps/api/.env` (second Railway Postgres) |
| Audit migrate | `npm run db:migrate:audit` succeeds |
| Health | `GET /health` → `"auditDatabase":"up"` when audit DB reachable |
| Trail | `POST /bookings` + `GET /audit/events?requestId=` → four ordered events |
| Correlation | Response header `X-Request-ID` matches audit `requestId` |
