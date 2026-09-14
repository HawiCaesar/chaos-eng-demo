import type { AuditEvent } from "@hotel-chaos/shared";
import { buildTimelineFromSources } from "./timeline.js";

const experimentId = "EXP-4242";
const at = "2026-09-08T10:42:00.000Z";

const statusHistory = [
  { status: "CREATED" as const, at: "2026-09-08T10:41:00.000Z" },
  { status: "STOPPING_DATABASE" as const, at },
  { status: "DATABASE_DOWN" as const, at: "2026-09-08T10:42:07.000Z" },
  { status: "GENERATING_FAILURE" as const, at: "2026-09-08T10:42:08.000Z" },
  { status: "RECOVERING_DATABASE" as const, at: "2026-09-08T10:42:19.000Z" },
  { status: "DATABASE_RECOVERED" as const, at: "2026-09-08T10:42:32.000Z" },
  { status: "VERIFYING_RECOVERY" as const, at: "2026-09-08T10:42:40.000Z" },
  { status: "COMPLETED" as const, at: "2026-09-08T10:42:44.000Z" },
];

const auditEvents: AuditEvent[] = [
  {
    eventId: "11111111-1111-4111-8111-111111111111",
    eventType: "REQUEST_RECEIVED",
    requestId: "22222222-2222-4222-8222-222222222222",
    bookingId: null,
    experimentId,
    timestamp: "2026-09-08T10:42:08.000Z",
    metadata: {},
  },
  {
    eventId: "33333333-3333-4333-8333-333333333333",
    eventType: "BOOKING_ATTEMPTED",
    requestId: "22222222-2222-4222-8222-222222222222",
    bookingId: null,
    experimentId,
    timestamp: "2026-09-08T10:42:08.100Z",
    metadata: {},
  },
  {
    eventId: "44444444-4444-4444-8444-444444444444",
    eventType: "DATABASE_UNAVAILABLE",
    requestId: "22222222-2222-4222-8222-222222222222",
    bookingId: null,
    experimentId,
    timestamp: "2026-09-08T10:42:08.200Z",
    metadata: { critical: true },
  },
  {
    eventId: "55555555-5555-4555-8555-555555555555",
    eventType: "DATABASE_RECOVERED",
    requestId: "66666666-6666-4666-8666-666666666666",
    bookingId: null,
    experimentId,
    timestamp: "2026-09-08T10:42:32.500Z",
    metadata: {},
  },
  {
    eventId: "77777777-7777-4777-8777-777777777777",
    eventType: "BOOKING_CREATED",
    requestId: "88888888-8888-4888-8888-888888888888",
    bookingId: "BK-9001",
    experimentId,
    timestamp: "2026-09-08T10:42:43.000Z",
    metadata: {},
  },
];

const timeline = buildTimelineFromSources(
  experimentId,
  statusHistory,
  auditEvents,
);

if (!timeline) {
  throw new Error("expected timeline");
}

console.log(
  timeline.events.map((event) => ({
    timestamp: event.timestamp,
    kind: event.kind,
    label: event.label,
    source: event.source,
  })),
);

const recoveredCount = timeline.events.filter(
  (event) => event.kind === "DATABASE_RECOVERED",
).length;
console.log("DATABASE_RECOVERED count (expect 1):", recoveredCount);

const omitted = timeline.events.some(
  (event) => event.eventType === "REQUEST_RECEIVED",
);
console.log("REQUEST_RECEIVED omitted (expect false):", omitted);

const auditOnly = buildTimelineFromSources(experimentId, undefined, auditEvents);
console.log(
  "audit-only labels:",
  auditOnly?.events.map((event) => event.label),
);

const missing = buildTimelineFromSources("EXP-0000", undefined, []);
console.log("empty timeline null (expect true):", missing === null);
