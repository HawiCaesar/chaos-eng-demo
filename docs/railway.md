# Railway — Milestone 1

This repo deploys the **API** (`apps/api`) via root `[railway.json](../railway.json)`. **Milestone 2+:** the API requires `DATABASE_URL` (Railway primary Postgres) at startup.

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
| `RAILWAY_API_TOKEN` | M4            | **Account** → Tokens (workspace that owns this project). Set on **booking-api**. Never commit.                                                  |
| `DATABASE_URL`      | **Yes (M2+)** | Reference from the Postgres service on **booking-api** (e.g. `${{Postgres.DATABASE_URL}}` in the Railway UI). API **fails at boot** if missing. |


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

### Find IDs for Milestone 4

```bash
railway status
```

Dashboard: Project → Settings; each service → Settings.

---



## IDs and URLs

Used by Milestone 4 GraphQL client config.


| Item                        | Value                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Project name                | `hotel-chaos-simulator`                                                                                  |
| Project ID                  | `292daa8f-847a-48e7-9839-d0f5f5c8a111`                                                                   |
| Environment ID              | `82352c2f-71f9-4a39-93bb-175924d93388`                                                                   |
| API service ID              | `4d0def26-f608-4358-900a-794949477ee4`                                                                   |
| Primary Postgres service ID | `c9a59b73-4469-41b2-87a5-a5f0791ba1a6`                                                                   |
| Public API URL              | [https://booking-api-production-25be.up.railway.app](https://booking-api-production-25be.up.railway.app) |
| `RAILWAY_API_TOKEN`         | **not in git**                                                                                           |


---



## Troubleshooting


| Symptom                              | Things to check                                                      |
| ------------------------------------ | -------------------------------------------------------------------- |
| `EBADENGINE` / Node 18 in build logs | Set `NIXPACKS_NODE_VERSION=20` or `22`; root `engines.node` ≥ 20.    |
| `EBUSY` on `node_modules/.cache`     | Remove `npm ci` from `buildCommand`; use only `npm run build:api`.   |
| Build fails otherwise                | Logs for `build:api`; `@hotel-chaos/shared` must build before `api`. |
| Crash on start                       | `node apps/api/dist/index.js` — `dist/` must exist after build.      |
| 502 / connection refused             | Listen on Railway’s `PORT` (via `env.PORT`).                         |
| CORS from local web                  | `WEB_ORIGIN` exactly `http://localhost:5173`.                        |
| `railway up` linked to Postgres      | Re-link to **booking-api**.                                          |




### Optional — static web on Railway (Milestone 1)

Static site for `apps/web`: separate service, `npm run build -w web`, serve `apps/web/dist`. Local Vite on `5173` is enough for M1–M2.
| `ENOTFOUND` / `postgres.railway.internal` locally | Use `DATABASE_PUBLIC_URL` in `apps/api/.env` for laptop dev; internal URL only works inside Railway. |
| `password authentication failed` / `28P01` | Refresh Postgres credentials in Railway; update `apps/api/.env`. |
| `DATABASE_URL is required` on API start | Set `DATABASE_URL` in `apps/api/.env` (local) or on **booking-api** (deploy). |
| `database: "down"` on `/health` but API is up | DB unreachable or bad credentials; bookings may 500/503 depending on error type. |