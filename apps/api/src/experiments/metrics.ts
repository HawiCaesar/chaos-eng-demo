import type {
  ExperimentMetricsResponse,
  ExperimentScenario,
  ExperimentStatus,
  ExperimentTimelineResponse,
  TimelineEvent,
  TimelineEventKind,
} from "@hotel-chaos/shared";
import { listAuditEvents } from "../db/auditEventsRepository.js";
import { getRecord } from "./store.js";
import { buildTimelineFromSources } from "./timeline.js";

export type MetricsEnvelope = {
  status: ExperimentStatus;
  scenario: ExperimentScenario;
};

const durationSeconds = (
  start: string | undefined,
  end: string | undefined,
): number | null => {
  if (!start || !end) {
    return null;
  }
  const deltaMs = Date.parse(end) - Date.parse(start);
  if (deltaMs < 0) {
    return null;
  }
  return Math.round(deltaMs / 1000);
};

const firstTimestamp = (
  events: TimelineEvent[],
  kind: TimelineEventKind,
): string | undefined => events.find((event) => event.kind === kind)?.timestamp;

const uniqueRequestIdsForKind = (
  events: TimelineEvent[],
  kind: TimelineEventKind,
): Set<string> => {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.kind !== kind || !event.requestId) {
      continue;
    }
    ids.add(event.requestId);
  }
  return ids;
};

const resolveResult = (
  envelope: MetricsEnvelope | undefined,
): ExperimentMetricsResponse["result"] => {
  if (!envelope) {
    return "UNKNOWN";
  }
  if (envelope.status === "COMPLETED") {
    return "RECOVERED";
  }
  if (envelope.status === "FAILED") {
    return "FAILED";
  }
  return "IN_PROGRESS";
};

const computeDatabaseDowntimeSeconds = (
  events: TimelineEvent[],
): number | null => {
  const recoveredAt = firstTimestamp(events, "DATABASE_RECOVERED");
  const stoppedAt = firstTimestamp(events, "DATABASE_STOPPED");
  const fromStopped = durationSeconds(stoppedAt, recoveredAt);
  if (fromStopped !== null) {
    return fromStopped;
  }
  const unavailableAt = firstTimestamp(events, "DATABASE_UNAVAILABLE");
  return durationSeconds(unavailableAt, recoveredAt);
};

const computeRecoveryTimeSeconds = (events: TimelineEvent[]): number | null => {
  const restartAt = firstTimestamp(events, "DATABASE_RESTART_INITIATED");
  const recoveredAt = firstTimestamp(events, "DATABASE_RECOVERED");
  return durationSeconds(restartAt, recoveredAt);
};

/** Pure summary from a composed timeline; returns null when timeline is null. */
export const buildMetricsFromTimeline = (
  experimentId: string,
  timeline: ExperimentTimelineResponse | null,
  envelope?: MetricsEnvelope,
): ExperimentMetricsResponse | null => {
  if (!timeline) {
    return null;
  }

  const { events } = timeline;
  const attemptedIds = uniqueRequestIdsForKind(events, "BOOKING_ATTEMPTED");
  const succeededIds = uniqueRequestIdsForKind(events, "BOOKING_SUCCEEDED");
  const failedIds = uniqueRequestIdsForKind(events, "BOOKING_FAILED");

  for (const requestId of succeededIds) {
    failedIds.delete(requestId);
  }

  const totalRequests = attemptedIds.size;
  const successfulRequests = succeededIds.size;
  const failedRequests = failedIds.size;
  const failureRatePercent =
    totalRequests > 0
      ? Math.round((failedRequests / totalRequests) * 100)
      : null;

  return {
    experimentId,
    scenario: envelope?.scenario ?? "database-outage",
    totalRequests,
    successfulRequests,
    failedRequests,
    failureRatePercent,
    databaseDowntimeSeconds: computeDatabaseDowntimeSeconds(events),
    recoveryTimeSeconds: computeRecoveryTimeSeconds(events),
    result: resolveResult(envelope),
  };
};

export const composeMetrics = async (
  experimentId: string,
): Promise<ExperimentMetricsResponse | null> => {
  const record = getRecord(experimentId);
  const auditEvents = await listAuditEvents({ experimentId });
  const timeline = buildTimelineFromSources(
    experimentId,
    record?.statusHistory,
    auditEvents,
  );

  const envelope = record
    ? { status: record.status, scenario: record.scenario }
    : undefined;

  return buildMetricsFromTimeline(experimentId, timeline, envelope);
};
