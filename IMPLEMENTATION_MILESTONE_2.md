# Implementation Plan — Milestone 2: Normal Booking Flow

Scope: only [plan.md](plan.md) Milestone 2 (Normal Booking Flow). Audit DB, Railway chaos, and experiments are later milestones.

## Goal

End-to-end **normal** hotel booking before any chaos functionality:

```text
React UI → Booking API → Primary PostgreSQL
```

The API exposes `POST /bookings`, `GET /bookings/:id`, and `GET /health`. The web app provides a booking form, success and error states, and a booking details view.

MVP checkpoint from plan.md: this path must work before adding Railway infrastructure controls.

Example success response (plan.md):

```json
{
  "status": "BOOKED",
  "bookingId": "BK-1821"
}
```

## Key Decisions (flag if you disagree)

- **Database driver** — `pg` (node-postgres) with a small pool module in the API; no ORM for M2.
- **Migrations** — versioned SQL under `apps/api/db/migrations/`; apply with `npm run db:migrate -w api` via a small Node script (reads SQL files, runs against `DATABASE_URL`). No node-pg-migrate / Prisma for now.
- **Shared contracts** — `@hotel-chaos/shared` exports Zod `createBookingSchema` plus TypeScript types for booking entity, create response, and API errors so web and API stay aligned.
- **`DATABASE_URL`** — required when the API starts (fail fast at boot if missing), enforced in `apps/api/src/env.ts` by extending parsed env after `parseEnv()` — keep `DATABASE_URL` optional in shared schema for future web-only tooling. Update `apps/api/.env.example` and [docs/railway.md](docs/railway.md).
- **Booking identity** — internal UUID primary key `id`; public identifier `booking_id` text unique, format `BK-` + 4-digit zero-padded random (1000–9999), retry on unique violation once. `GET /bookings/:id` uses the public `booking_id` (e.g. `BK-1821`).
- **Status** — persist `status` as `BOOKED` on create; POST returns `{ status, bookingId }`; GET returns the full booking record for the details page.
- **Errors (chaos-ready, no audit yet)** — validation failures → `400` with field messages; primary DB unreachable → `503` with `{ code: "DATABASE_UNAVAILABLE", message: "..." }` so the web “infrastructure failure” state matches the core MVP (plan.md) before M3 audit writes.
- **Health** — extend `GET /health` with `database: "up" | "down"` from `SELECT 1`; always HTTP **200** (liveness-style, same as M1 public checks) so Railway does not flap when Postgres is intentionally stopped in later milestones.
- **Frontend** — React Router v7 library mode, Tailwind v3, `fetch` + `VITE_API_URL` (M1 pattern); routes `/` (booking form + compact API health) and `/bookings/:bookingId` (details). Shared helper `apps/web/src/lib/api.ts`.
- **Database hosting (no local Postgres)** — use the **Railway primary Postgres** already provisioned in M1 for both deployed API and local dev. Put Railway’s connection string in `apps/api/.env` as `DATABASE_URL` (typically **`DATABASE_PUBLIC_URL`** from the Postgres service for dev from your laptop, or the private `DATABASE_URL` when running migrate via `railway run`). Skip `docker-compose.yml` — portfolio scope, one DB, less setup.

## Target Structure

```text
chaos-eng-demo/
├── packages/shared/src/
│   ├── booking.ts                  # zod schemas + types
│   └── index.ts                    # re-export booking
├── apps/api/
│   ├── db/migrations/
│   │   └── 001_create_bookings.sql
│   ├── src/
│   │   ├── db/
│   │   │   ├── pool.ts
│   │   │   ├── migrate.ts
│   │   │   └── bookingsRepository.ts
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   └── bookings.ts
│   │   ├── errors.ts               # map pg/zod to HTTP
│   │   ├── env.ts                  # require DATABASE_URL
│   │   └── index.ts                # mount routers, SIGTERM pool.end
│   └── package.json                # pg dep; db:migrate script
└── apps/web/src/
    ├── lib/api.ts
    ├── pages/
    │   ├── BookingPage.tsx         # form + success / validation / infra states
    │   └── BookingDetailsPage.tsx
    └── App.tsx                     # / and /bookings/:bookingId
```

```mermaid
flowchart TD
    web["apps/web"] -->|POST GET| api["apps/api"]
    web --> shared["packages/shared"]
    api --> shared
    api --> pool["pg Pool"]
    pool --> primaryDb["Railway Primary PostgreSQL"]
```

## Steps

### 1. Shared booking model (`packages/shared`)

Add `src/booking.ts` and export from `src/index.ts`.

**Fields** (plan.md + storage):

| Field | Role |
|-------|------|
| `id` | UUID, internal PK |
| `bookingId` | Public id in JSON (`booking_id` column), e.g. `BK-1821` |
| `guestName` | Required string |
| `email` | Valid email |
| `roomId` | Required string (opaque room code for M2) |
| `checkIn` / `checkOut` | ISO date strings `YYYY-MM-DD` |
| `status` | `BOOKED` for M2 |
| `createdAt` | ISO timestamp from DB |

**Zod (`createBookingSchema`)** — body for `POST /bookings` only (no status/id):

- `guestName`: min 1, max 200
- `email`: email
- `roomId`: min 1, max 50
- `checkIn`, `checkOut`: regex or `z.string().date()` (Zod 3.23+)
- `.refine`: `checkOut > checkIn`

Export types: `CreateBookingInput`, `Booking`, `CreateBookingResponse`, `ApiErrorBody` (`message`, optional `code`, optional `details` for validation).

Web can import the schema for client-side validation (duplicate parse before submit is fine for M2).

### 2. Primary DB schema

`apps/api/db/migrations/001_create_bookings.sql`:

```sql
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL UNIQUE,
  guest_name TEXT NOT NULL,
  email TEXT NOT NULL,
  room_id TEXT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'BOOKED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_booking_id_idx ON bookings (booking_id);
```

**Apply migrations**

From your machine against Railway Postgres (pick one):

1. **`.env` on laptop** — copy **`DATABASE_PUBLIC_URL`** (or private `DATABASE_URL`) from the Railway Postgres service into `apps/api/.env`, then:

   ```bash
   npm run db:migrate -w api
   ```

2. **CLI with service env** — link to **Postgres** (not booking-api):

   ```bash
   railway link   # Postgres service
   railway run npm run db:migrate -w api
   ```

M2 does **not** add a `releaseCommand` to [railway.json](railway.json); run migrations explicitly once per environment before first booking. Optional later: deploy hook.

### 3. API environment

`apps/api/src/env.ts` — after `parseEnv()`:

```ts
if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the booking API");
}
```

`apps/api/.env.example` add (placeholder — use real values from Railway dashboard, never commit secrets):

```env
# Railway Postgres → Variables tab (DATABASE_PUBLIC_URL for local dev from your machine)
DATABASE_URL=postgresql://user:pass@host:port/railway
```

- **Local dev (`npm run dev -w api`)** — `DATABASE_URL` in `apps/api/.env` pointing at Railway Postgres.
- **Deployed booking-api** — reference variable from Postgres service (`DATABASE_URL` or `${{Postgres.DATABASE_URL}}` per Railway UI).

### 4. API database layer

- **`pool.ts`** — `new Pool({ connectionString: env.DATABASE_URL })`; export `getPool()`; `closePool()` for tests/shutdown.
- **`migrate.ts`** — read `db/migrations/*.sql` in order; execute; track applied migrations in `schema_migrations` table (simple: create table `name TEXT PRIMARY KEY`, insert after each file).
- **`bookingsRepository.ts`**:
  - `insertBooking(input: CreateBookingInput): Promise<Booking>` — generate `booking_id`, insert, map row to `Booking` (camelCase JSON).
  - `findBookingByPublicId(bookingId: string): Promise<Booking | null>`.

**Boot** — in `index.ts`, optionally call migrate on startup only in development (document: prefer explicit `db:migrate`; dev auto-migrate is optional convenience — default **off** to match production).

**Shutdown** — `SIGTERM` → `await closePool()`.

### 5. API routes

**`src/routes/health.ts`**

```ts
// GET /health
{
  status: "ok",
  service: "booking-api",
  timestamp: "...",
  database: "up" | "down"
}
```

Probe: `pool.query("SELECT 1")`; on failure set `database: "down"` (still 200).

**`src/routes/bookings.ts`**

- `POST /bookings` — `createBookingSchema.safeParse(req.body)` → 400 with `details` on failure; else insert → **201**:

```json
{ "status": "BOOKED", "bookingId": "BK-1821" }
```

- `GET /bookings/:id` — param is public id (`BK-...`); 404 `{ "message": "Booking not found" }` if missing; 200 full `Booking` JSON.

**Error mapping (`errors.ts`)**

- Zod → 400
- `pg` connection / timeout errors → 503 `{ "code": "DATABASE_UNAVAILABLE", "message": "Database is unavailable" }`
- Unexpected → 500 generic message (log server-side)

Mount routers in `index.ts`; keep CORS and `express.json()` as in M1.

**Dependencies** — add `"pg"` and `"@types/pg"` to `apps/api/package.json`.

### 6. Web UI

**`lib/api.ts`**

- `getApiBaseUrl()` from `import.meta.env.VITE_API_URL`
- `createBooking(input): Promise<CreateBookingResponse>` — POST, throw typed error with `status` and parsed body
- `getBooking(bookingId): Promise<Booking>`
- `getHealth()` — for small status badge on home

**`BookingPage.tsx`** (route `/`)

- Form: guestName, email, roomId, checkIn, checkOut (native `type="date"` or text with pattern)
- On submit: client validate with shared schema; POST; states:
  - **Success** — show `bookingId`, link to `/bookings/:bookingId`
  - **Validation** — inline field errors + `aria-live="polite"` region
  - **Infrastructure** — if response is 503 and `code === "DATABASE_UNAVAILABLE"`, dedicated banner (retry button)
- Compact health indicator (reuse M1 fetch pattern or `getHealth()` including `database`)

**`BookingDetailsPage.tsx`** (route `/bookings/:bookingId`)

- `useEffect` fetch GET; loading skeleton; 404 message; table or definition list of all fields

**`App.tsx`**

```tsx
<Route path="/" element={<BookingPage />} />
<Route path="/bookings/:bookingId" element={<BookingDetailsPage />} />
```

Remove or fold M1-only `HomePage` health demo into `BookingPage` footer to avoid duplicate routes.

**A11y** — `<label htmlFor>`, focus management on errors, keyboard-submit on form.

**Web dependency** — ensure `apps/web` depends on `@hotel-chaos/shared` for schema/types (workspace `"*"`); Vite may need `optimizeDeps.include` or resolve workspace package — follow M1 monorepo pattern (build shared before web dev if needed: document `npm run build -w @hotel-chaos/shared` once).

### 7. Root scripts and docs

Root `package.json`:

```json
"db:migrate": "npm run db:migrate -w api"
```

**README.md** — M2 section: Railway `DATABASE_URL` in `apps/api/.env`, migrate, dev flow, curl examples (no Docker Postgres).

**docs/railway.md** — add **Milestone 2** section: link `DATABASE_URL` on booking-api, run migration, curl booking against public URL, expect `database` in `/health`.

## Verification Checklist (Milestone 2 done when)

- [ ] `DATABASE_URL` set in `apps/api/.env` (Railway Postgres connection string)
- [ ] `npm run db:migrate -w api` applies `001_create_bookings.sql` without error
- [ ] `npm run dev` — web on 5173, api on 3001
- [ ] `GET /health` returns 200 with `"database":"up"` when Postgres is reachable
- [ ] `POST /bookings` with valid body returns 201 and `{ "status": "BOOKED", "bookingId": "BK-...." }`
- [ ] Row visible in Postgres (`SELECT * FROM bookings LIMIT 1`)
- [ ] `GET /bookings/BK-xxxx` returns the created booking
- [ ] Invalid body returns 400 with validation details
- [ ] With Postgres stopped or bad `DATABASE_URL`: `POST /bookings` returns 503 with `code` `DATABASE_UNAVAILABLE`
- [ ] Web: success state, validation errors, and infrastructure failure banner all observable
- [ ] `npm run typecheck` passes all workspaces
- [ ] Railway: `DATABASE_URL` on booking-api, migration run, public API can create and fetch a booking

### curl smoke tests

```bash
API=http://localhost:3001

curl -s "$API/health" | jq .

curl -s -X POST "$API/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "guestName": "Ada Lovelace",
    "email": "ada@example.com",
    "roomId": "101",
    "checkIn": "2026-09-01",
    "checkOut": "2026-09-03"
  }' | jq .

curl -s "$API/bookings/BK-1821" | jq .
# use bookingId from POST response
```

## Explicitly Out of Scope (later milestones)

- Audit database, `audit_events`, and correlation IDs (M3)
- Railway GraphQL client, stop/restart database (M4–M5)
- Experiments, timeline, recovery metrics (M6–M8)
- Railway logs UI (M9)
- Auth, room catalog API, payments, cancellations
- Automatic migrations on every Railway deploy (optional follow-up)
- Local Postgres via Docker Compose (use Railway DB for dev and prod)
