# Railway — Milestone 1

This repo deploys the **API** (`apps/api`) via root `[railway.json](../railway.json)`. **Milestone 2+:** the API requires `DATABASE_URL` (Railway primary Postgres) at startup. **Milestone 3+:** also requires `AUDIT_DATABASE_URL` (second Postgres).

## Repo setup (already done)

- `[railway.json](../railway.json)` — Nixpacks runs `npm run build:api` (install is handled by Nixpacks; do **not** add `npm ci` to `buildCommand` — it can cause `EBUSY` on `node_modules/.cache`). Start: `node apps/api/dist/index.js`.
- Root `[package.json](../package.json)` — `"engines": { "node": ">=20" }` and script `npm run build:api` (shared + api).
- `[.dockerignore](../.dockerignore)` — keeps local `node_modules` out of `railway up` uploads.



## CLI check

```bash
npx @railway/cli --version
npx @railway/cli whoami      # after login
```

Or install globally: `npm i -g @railway/cli`, then `railway login`.

**Link the API service:** run `railway link` and choose **booking-api** (or your API service name) — **not** Postgres.

---



## Your setup checklist

Run from the **monorepo root** (`chaos-eng-demo/`).


| #   | Action                                                                                            | Done |
| --- | ------------------------------------------------------------------------------------------------- | ---- |
| 1   | `railway login` (or `npx @railway/cli login`)                                                     | ☑    |
| 2   | `railway init` → project name `hotel-chaos-simulator`                                             | ☑    |
| 3   | `railway add --database postgres` (primary DB for M2)                                             | ☑    |
| 3b  | Second `railway add --database postgres` (audit DB for M3); rename service in dashboard if helpful | ☐    |
| 4   | **booking-api** service deploys this repo (`railway up` while linked to API, or GitHub)           | ☑    |
| 5   | Service variables set (see below)                                                                 | ☑    |
| 6   | Public domain on **booking-api** (Settings → Networking)                                          | ☑    |
| 7   | `GET /health` returns 200 on public URL ([Verification](#verification))                           | ☑    |
| 8   | [Account token](https://railway.com/account/tokens) → `RAILWAY_API_TOKEN` on **booking-api** (M4) | ☑    |
| 9   | [IDs and URLs](#ids-and-urls) filled in below                                                     | ☑    |




### Build settings (booking-api)


| Setting                 | Value                                                       |
| ----------------------- | ----------------------------------------------------------- |
| `NIXPACKS_NODE_VERSION` | `20` or `22` (required — web workspace deps need Node ≥ 20) |
| `WEB_ORIGIN`            | `http://localhost:5173` for local Vite → deployed API       |




### API service variables


| Variable            | Required      | Notes                                                                                                                                           |
| ------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEB_ORIGIN`        | Yes           | CORS allowlist. M1 local web: `http://localhost:5173`.                                                                                          |
| `PORT`              | No            | Injected by Railway.                                                                                                                            |
| `NODE_ENV`          | No            | Often `production`.                                                                                                                             |
| `RAILWAY_API_TOKEN` | M4+ | **Account** → Tokens (workspace that owns this project). Set on **booking-api** for M5+; also used locally for `npm run railway:smoke`. Never commit. |
| `RAILWAY_ENVIRONMENT_ID` | **Yes (M5+)** | See [IDs and URLs](#ids-and-urls). Required for API boot in M5. |
| `RAILWAY_PRIMARY_DB_SERVICE_ID` | **Yes (M5+)** | Primary Postgres service ID (stop/restart target). |
| `RAILWAY_AUDIT_DB_SERVICE_ID` | **Yes (M5+)** | Audit Postgres service ID (status only). |
| `RAILWAY_API_SERVICE_ID` | **Yes (M5+)** | booking-api service ID (status only). |
| `RAILWAY_PROJECT_ID` | Optional | Project ID from [IDs and URLs](#ids-and-urls); future project-scoped queries. |
| `DATABASE_URL`      | **Yes (M2+)** | Reference from the **primary** Postgres service on **booking-api** (e.g. `${{Postgres.DATABASE_URL}}` in the Railway UI). API **fails at boot** if missing. |
| `AUDIT_DATABASE_URL`| **Yes (M3+)** | Reference from the **audit** Postgres service on **booking-api**. API **fails at boot** if missing. Use public URL in local `apps/api/.env` for laptop dev. |


Set variables (linked to **booking-api**):

```bash
railway variables set WEB_ORIGIN=http://localhost:5173
railway variables set RAILWAY_API_TOKEN=<account-token>   # optional until M4
```



### Tokens: project vs account


| Token             | Where created                                          | Use                                                           |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| **Project token** | Project → Settings → Tokens                            | CI / CLI deploy — env `RAILWAY_TOKEN`                         |
| **Account token** | [Account → Tokens](https://railway.com/account/tokens) | GraphQL API (M4) — env `RAILWAY_API_TOKEN` on the API service |


Deploy from CLI:

```bash
npm run build:api    # optional local smoke test
railway link         # select booking-api
railway up
```

Or connect GitHub in the dashboard and deploy on push.

---



## Milestone 2 — primary Postgres



### Local API (`npm run dev -w api`)

1. Copy `DATABASE_PUBLIC_URL` (or private `DATABASE_URL`) from the Railway **Postgres** service → Variables into `apps/api/.env` as `DATABASE_URL` (see `[apps/api/.env.example](../apps/api/.env.example)`).
2. Apply migrations once per environment:
  ```bash
   npm run db:migrate
  ```
   Or with CLI env from Postgres (link **Postgres**, not booking-api):
3. Start the API — without `DATABASE_URL` in `apps/api/.env`, the process exits immediately with `DATABASE_URL is required for the booking API`.



### Deployed booking-api

1. On **booking-api** service variables, set `DATABASE_URL` to reference the Postgres service connection string (Railway variable reference / shared variable from the Postgres plugin).
2. Run `npm run db:migrate` against that database before the first booking (from your laptop with `apps/api/.env`, or `railway run` while linked to Postgres). M2 does not auto-migrate on deploy.
3. After deploy, verify on the **public API URL** ([Milestone 2 verification](#milestone-2-verification)).

---

## Milestone 3 — audit Postgres

### Local API (`npm run dev -w api`)

1. Copy **`DATABASE_PUBLIC_URL`** from the **audit** Postgres service into `apps/api/.env` as **`AUDIT_DATABASE_URL`** (see `[apps/api/.env.example](../apps/api/.env.example)`). Keep **`DATABASE_URL`** pointed at the primary Postgres from M2.
2. Apply audit migrations once per environment:

   ```bash
   npm run db:migrate:audit
   ```

3. Start the API — without `AUDIT_DATABASE_URL` in `apps/api/.env`, the process exits with `AUDIT_DATABASE_URL is required for the booking API`.

### Deployed booking-api

1. On **booking-api** service variables, set `AUDIT_DATABASE_URL` to reference the audit Postgres connection string (variable reference from the second Postgres plugin).
2. Run `npm run db:migrate:audit` against the audit database before relying on event trails (from laptop with `apps/api/.env`, or `railway run` while linked to audit Postgres).
3. After deploy, verify [Milestone 3 verification](#milestone-3-verification).

---

## Milestone 4 — Railway GraphQL client

M4 adds `@hotel-chaos/railway-client` — a typed wrapper around Railway’s [public GraphQL API](https://docs.railway.com/reference/public-api) (`https://backboard.railway.com/graphql/v2`). The booking API does **not** import it yet (M5+); use the smoke script locally.

Implementation notes: [`IMPLEMENTATION_MILESTONE_4.md`](../IMPLEMENTATION_MILESTONE_4.md).

### Account token on booking-api

Set **`RAILWAY_API_TOKEN`** on the **booking-api** service (same [account token](https://railway.com/account/tokens) as GraphiQL). Required for M5 server-side chaos routes; optional for API boot in M4. **Never commit** the token.

### Local env (`apps/api/.env`)

Copy placeholders from [`apps/api/.env.example`](../apps/api/.env.example). For smoke tests, set (values from [IDs and URLs](#ids-and-urls)):

| Variable | Required for smoke | Notes |
| -------- | ------------------ | ----- |
| `RAILWAY_API_TOKEN` | Yes | Account token |
| `RAILWAY_ENVIRONMENT_ID` | Yes | Target environment |
| `RAILWAY_PRIMARY_DB_SERVICE_ID` | Yes | Default target: **primary Postgres** |
| `RAILWAY_PROJECT_ID` | No | Optional; reserved for later milestones |

The API still starts with only `DATABASE_URL` and `AUDIT_DATABASE_URL`; Railway ID vars are read when you run the client or smoke script.

### Smoke script (from repo root)

**Status only (safe)** — prints service + deployment status for primary Postgres:

```bash
npm run railway:smoke
```

The script loads `apps/api/.env` automatically (no need to `source` it).

**Full stop/restart cycle (disruptive)** — stops the **primary** Postgres deployment, polls until stopped, restarts, polls until running:

```bash
npm run railway:smoke -- --execute-stop-restart
```

While primary Postgres is stopped, **`POST /bookings`** should return **503** with `DATABASE_UNAVAILABLE`. The **audit** Postgres service is not targeted by default; **`GET /health`** should still show `auditDatabase: "up"` if audit DB is running.

---

## Milestone 5 — chaos control dashboard

The Booking API wraps `@hotel-chaos/railway-client` and exposes infrastructure HTTP routes. The browser never holds `RAILWAY_API_TOKEN`. Dashboard: [http://localhost:5173/chaos](http://localhost:5173/chaos). Implementation: [`IMPLEMENTATION_MILESTONE_5.md`](../IMPLEMENTATION_MILESTONE_5.md).

**`/infrastructure` mutations are unauthenticated.** Stop targets **primary Postgres only**. Bookings return **503** `DATABASE_UNAVAILABLE` until Restart. Audit DB and booking-api are status-only (no stop/restart routes).

### Required Railway vars (API boot)

Local `apps/api/.env` **and** the deployed **booking-api** service must set:

| Variable | Value |
| -------- | ----- |
| `RAILWAY_API_TOKEN` | Account token (never commit) |
| `RAILWAY_ENVIRONMENT_ID` | [IDs and URLs](#ids-and-urls) |
| `RAILWAY_PRIMARY_DB_SERVICE_ID` | Primary Postgres |
| `RAILWAY_AUDIT_DB_SERVICE_ID` | Audit Postgres |
| `RAILWAY_API_SERVICE_ID` | booking-api |

The API **will not start** if any are missing. `RAILWAY_PROJECT_ID` stays optional. Set the IDs on **booking-api** before deploying this milestone, or the production process will crash on boot.

### Endpoints

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/infrastructure` | Status for `primary-db`, `audit-db`, `booking-api` (that order). DB `status` is a SQL `SELECT 1` probe; `rawDeploymentStatus` is Railway’s latest deploy record (often still `SUCCESS` after stop). |
| `POST` | `/infrastructure/primary-db/stop` | **202** `{ key, action }`; poll GET until `STOPPED`. |
| `POST` | `/infrastructure/primary-db/restart` | **202**; poll until `RUNNING`. |

Local web: `VITE_API_URL=http://localhost:3001` in `apps/web/.env` (restart Vite after changing it). Pointing Vite at the public API URL before this milestone is deployed yields CORS/network errors on `/infrastructure`.

---

## Verification



### Milestone 1 — API liveness

```bash
export YOUR_API_PUBLIC_URL="https://booking-api-production-25be.up.railway.app"

curl -s "${YOUR_API_PUBLIC_URL}/health"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${YOUR_API_PUBLIC_URL}/health"
```

**Pass criteria:**

1. HTTP **200** on the second command.
2. Body includes `"status":"ok"` and `"service":"booking-api"`.
3. Dashboard: **Postgres** + **booking-api** in `hotel-chaos-simulator`.

**Browser:** `VITE_API_URL` in `apps/web/.env` → public API URL; `WEB_ORIGIN=http://localhost:5173` on API; reload [http://localhost:5173](http://localhost:5173).

### Milestone 2 — bookings + database probe

Link `DATABASE_URL` on **booking-api** to the Postgres service, run `npm run db:migrate`, then:

```bash
export YOUR_API_PUBLIC_URL="https://booking-api-production-25be.up.railway.app"

curl -s "${YOUR_API_PUBLIC_URL}/health" | jq .
# expect "database": "up" when Postgres is running

curl -s -X POST "${YOUR_API_PUBLIC_URL}/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "guestName": "Hawi Odhiambo",
    "email": "hawi@example.com",
    "roomId": "101",
    "checkIn": "2026-09-01",
    "checkOut": "2026-09-03"
  }' | jq .

curl -s "${YOUR_API_PUBLIC_URL}/bookings/BK-xxxx" | jq .
# use bookingId from POST response
```

**Pass criteria:** `/health` includes `"database":"up"`; POST returns **201** with `{ "status": "BOOKED", "bookingId": "BK-...." }`; GET by public id returns the booking JSON.

### Milestone 3 — audit trail + audit database probe

Provision a **second** Postgres, set `AUDIT_DATABASE_URL` on **booking-api**, run `npm run db:migrate:audit`, then:

```bash
export YOUR_API_PUBLIC_URL="https://booking-api-production-25be.up.railway.app"

curl -s "${YOUR_API_PUBLIC_URL}/health" | jq .
# expect "database": "up" and "auditDatabase": "up"

curl -si -X POST "${YOUR_API_PUBLIC_URL}/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "guestName": "Hawi Odhiambo",
    "email": "hawi@example.com",
    "roomId": "101",
    "checkIn": "2026-09-01",
    "checkOut": "2026-09-03"
  }' | tee /tmp/m3-booking.txt

REQ=$(grep -i '^x-request-id:' /tmp/m3-booking.txt | awk '{print $2}' | tr -d '\r')
curl -s "${YOUR_API_PUBLIC_URL}/audit/events?requestId=${REQ}" | jq .
```

**Pass criteria:** `/health` includes `"auditDatabase":"up"`; audit `events` array has four types in order: `REQUEST_RECEIVED`, `VALIDATION_PASSED`, `BOOKING_ATTEMPTED`, `BOOKING_CREATED`.

### Milestone 4 — Railway client smoke

Set `RAILWAY_API_TOKEN`, `RAILWAY_ENVIRONMENT_ID`, and `RAILWAY_PRIMARY_DB_SERVICE_ID` in `apps/api/.env` ([IDs and URLs](#ids-and-urls)). From repo root:

```bash
npm run railway:smoke
```

**Pass criteria:** JSON includes `serviceStatus.status` (typically `RUNNING` when healthy), `rawDeploymentStatus: "SUCCESS"`, and matching `deploymentStatus`.

Optional chaos cycle (stops primary DB — bookings fail until restart):

```bash
npm run railway:smoke -- --execute-stop-restart
```

During the stopped window (local or deployed API):

```bash
curl -si -X POST "http://localhost:3001/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "guestName": "Test Guest",
    "email": "test@example.com",
    "roomId": "101",
    "checkIn": "2026-09-01",
    "checkOut": "2026-09-03"
  }'
# Expect 503 + DATABASE_UNAVAILABLE while primary DB is stopped
```

### Milestone 5 — chaos control dashboard

Set all M5 `RAILWAY_*` vars on **booking-api** and in `apps/api/.env`. Local:

```bash
npm run dev
# Web: http://localhost:5173/chaos  (VITE_API_URL=http://localhost:3001)
# API: http://localhost:3001

API=http://localhost:3001
curl -s "$API/infrastructure" | jq '.services[] | {key, status, rawDeploymentStatus, actions}'
```

**Pass criteria:** three services in order; primary has `actions: ["stop","restart"]`; audit and booking-api have empty `actions`. From `/chaos`, Stop → primary `STOPPED` (raw may stay `SUCCESS`) → bookings **503** → Restart → bookings **201**.

---
### Find IDs for Milestone 4 / 5

```bash
railway status
```

Dashboard: Project → Settings; each service → Settings.

---



## IDs and URLs

Used by Milestone 4 smoke tests and Milestone 5 `/infrastructure` routes.

| Item                        | Value                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Project name                | `hotel-chaos-simulator`                                                                                  |
| Project ID                  | `292daa8f-847a-48e7-9839-d0f5f5c8a111`                                                                   |
| Environment ID              | `82352c2f-71f9-4a39-93bb-175924d93388`                                                                   |
| API service ID              | `4d0def26-f608-4358-900a-794949477ee4`                                                                   |
| Primary Postgres service ID | `c9a59b73-4469-41b2-87a5-a5f0791ba1a6`                                                                   |
| Audit Postgres service ID   | `2bf5d48e-69d8-40c3-b180-68bb659f9a7e`                                                                   |
| Public API URL              | [https://booking-api-production-25be.up.railway.app](https://booking-api-production-25be.up.railway.app) |
| `RAILWAY_API_TOKEN`         | **not in git**                                                                                           |


---



## Troubleshooting


| Symptom | Things to check |
| ------------------------------------ | -------------------------------------------------------------------- |
| `EBADENGINE` / Node 18 in build logs | Set `NIXPACKS_NODE_VERSION=20` or `22`; root `engines.node` ≥ 20. |
| `EBUSY` on `node_modules/.cache` | Remove `npm ci` from `buildCommand`; use only `npm run build:api`. |
| Build fails otherwise | Logs for `build:api`; `@hotel-chaos/shared` must build before `api`. |
| Crash on start | `node apps/api/dist/index.js` — `dist/` must exist after build. |
| 502 / connection refused | Listen on Railway’s `PORT` (via `env.PORT`). |
| CORS from local web | `WEB_ORIGIN` exactly `http://localhost:5173`. |
| `railway up` linked to Postgres | Re-link to **booking-api**. |
| `ENOTFOUND` / `postgres.railway.internal` locally | Use `DATABASE_PUBLIC_URL` in `apps/api/.env` for laptop dev; internal URL only works inside Railway. |
| `password authentication failed` / `28P01` | Refresh Postgres credentials in Railway; update `apps/api/.env`. |
| `DATABASE_URL is required` on API start | Set `DATABASE_URL` in `apps/api/.env` (local) or on **booking-api** (deploy). |
| `RAILWAY_* is required for the booking API` on start | Set token + environment + three service IDs in `apps/api/.env` (local) and on **booking-api** (deploy). See [IDs and URLs](#ids-and-urls). |
| CORS / `/infrastructure` to the public API from local Vite | `VITE_API_URL=http://localhost:3001` until M5 is deployed; `WEB_ORIGIN=http://localhost:5173` on the API. |
| `primary database pool error` after Stop | Expected. Idle clients drop; the API stays up. Next probe should report `STOPPED`. |
| `auditDatabase: "down"` on `/health` | Audit Postgres unreachable; booking may still succeed but audit trail may be incomplete. |
| `database: "down"` on `/health` but API is up | DB unreachable or bad credentials; bookings may 500/503 depending on error type. |
| `/infrastructure` primary-db `STOPPED` but `rawDeploymentStatus: SUCCESS` | Expected. Railway does not rewrite latest deployment to `REMOVED` on stop. `status` is the SQL probe; `rawDeploymentStatus` is the deploy record. `/health` `database` should match (`down` when `STOPPED`). |
| Booking `500` / no `BOOKING_FAILED` in `audit_events` while audit is down | Audit writes are swallowed (`audit write failed` in API logs). Failure events are stored in audit, so they vanish if audit is down. Primary-up + audit-down should still 201 if insert succeeds. Primary-down bookings should be 503 `DATABASE_UNAVAILABLE` (`isDatabaseUnavailable` includes `node-pg` “connection terminated” messages with no `code`). See [IMPLEMENTATION_MILESTONE_5.md](../IMPLEMENTATION_MILESTONE_5.md) Known behavior. |

### Optional — static web on Railway (Milestone 1)

Static site for `apps/web`: separate service, `npm run build -w web`, serve `apps/web/dist`. Local Vite on `5173` is enough for M1–M2.