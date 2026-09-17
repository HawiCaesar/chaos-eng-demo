import type { AuditEvent } from "@hotel-chaos/shared";
import { buildMetricsFromTimeline } from "./metrics.js";
import { buildTimelineFromSources } from "./timeline.js";

const experimentId = "EXP-4242";
const at = "2026-09-08T10:42:00.000Z";

const failureRequestId = "22222222-2222-4222-8222-222222222222";
const recoveryRequestId = "88888888-8888-4888-8888-888888888888";

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

const happyPathAuditEvents: AuditEvent[] = [
  {
    eventId: "33333333-3333-4333-8333-333333333333",
    eventType: "BOOKING_ATTEMPTED",
    requestId: failureRequestId,
    bookingId: null,
    experimentId,
    timestamp: "2026-09-08T10:42:08.100Z",
    metadata: {},
  },
  {
    eventId: "44444444-4444-4444-8444-444444444444",
    eventType: "DATABASE_UNAVAILABLE",
    requestId: failureRequestId,
    bookingId: null,
    experimentId,
    timestamp: "2026-09-08T10:42:08.200Z",
    metadata: { critical: true },
  },
  {
    eventId: "a1111111-1111-4111-8111-111111111111",
    eventType: "BOOKING_FAILED",
    requestId: failureRequestId,
    bookingId: null,
    experimentId,
    timestamp: "2026-09-08T10:42:08.300Z",
    metadata: {},
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
    eventId: "b2222222-2222-4222-8222-222222222222",
    eventType: "BOOKING_ATTEMPTED",
    requestId: recoveryRequestId,
    bookingId: null,
    experimentId,
    timestamp: "2026-09-08T10:42:42.900Z",
    metadata: {},
  },
  {
    eventId: "77777777-7777-4777-8777-777777777777",
    eventType: "BOOKING_CREATED",
    requestId: recoveryRequestId,
    bookingId: "BK-9001",
    experimentId,
    timestamp: "2026-09-08T10:42:43.000Z",
    metadata: {},
  },
];

const envelope = {
  status: "COMPLETED" as const,
  scenario: "database-outage" as const,
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const timelineHappy = buildTimelineFromSources(
  experimentId,
  statusHistory,
  happyPathAuditEvents,
);
const metricsHappy = buildMetricsFromTimeline(
  experimentId,
  timelineHappy,
  envelope,
);

if (!metricsHappy) {
  throw new Error("happy path: expected metrics");
}
assert(metricsHappy.totalRequests === 2, "happy path: totalRequests");
assert(metricsHappy.successfulRequests === 1, "happy path: successfulRequests");
assert(metricsHappy.failedRequests === 1, "happy path: failedRequests");
assert(metricsHappy.failureRatePercent === 50, "happy path: failureRatePercent");
assert(metricsHappy.result === "RECOVERED", "happy path: result");
assert(metricsHappy.databaseDowntimeSeconds === 26, "happy path: databaseDowntimeSeconds");
assert(metricsHappy.recoveryTimeSeconds === 14, "happy path: recoveryTimeSeconds");

const timelineAuditOnly = buildTimelineFromSources(
  experimentId,
  undefined,
  happyPathAuditEvents,
);
const metricsAuditOnly = buildMetricsFromTimeline(
  experimentId,
  timelineAuditOnly,
  undefined,
);

if (!metricsAuditOnly) {
  throw new Error("audit-only: expected metrics");
}
assert(metricsAuditOnly.totalRequests === 2, "audit-only: totalRequests");
assert(metricsAuditOnly.successfulRequests === 1, "audit-only: successfulRequests");
assert(metricsAuditOnly.failedRequests === 1, "audit-only: failedRequests");
assert(metricsAuditOnly.recoveryTimeSeconds === null, "audit-only: recoveryTimeSeconds");
assert(metricsAuditOnly.result === "UNKNOWN", "audit-only: result");
assert(
  metricsAuditOnly.databaseDowntimeSeconds === 24,
  "audit-only: databaseDowntimeSeconds (UNAVAILABLE → RECOVERED)",
);

const extraHumanRequestId = "99999999-9999-4999-8999-999999999999";
const auditWithExtraHuman: AuditEvent[] = [
  ...happyPathAuditEvents,
  {
    eventId: "c3333333-3333-4333-8333-333333333333",
    eventType: "BOOKING_ATTEMPTED",
    requestId: extraHumanRequestId,
    bookingId: null,
    experimentId,
    timestamp: "2026-09-08T10:42:10.000Z",
    metadata: {},
  },
  {
    eventId: "d4444444-4444-4444-8444-444444444444",
    eventType: "BOOKING_FAILED",
    requestId: extraHumanRequestId,
    bookingId: null,
    experimentId,
    timestamp: "2026-09-08T10:42:10.100Z",
    metadata: {},
  },
];

const timelineExtra = buildTimelineFromSources(
  experimentId,
  statusHistory,
  auditWithExtraHuman,
);
const metricsExtra = buildMetricsFromTimeline(
  experimentId,
  timelineExtra,
  envelope,
);

if (!metricsExtra) {
  throw new Error("extra human: expected metrics");
}
assert(metricsExtra.totalRequests === 3, "extra human: totalRequests");
assert(metricsExtra.failedRequests === 2, "extra human: failedRequests");

const metricsEmpty = buildMetricsFromTimeline(experimentId, null, envelope);
assert(metricsEmpty === null, "empty sources: expected null");

console.log("metrics.smoke.ts: all assertions passed");
