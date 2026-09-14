import type {
  AuditEvent,
  AuditEventType,
  ExperimentStatusHistoryEntry,
  ExperimentTimelineResponse,
  TimelineEvent,
} from "@hotel-chaos/shared";
import { listAuditEvents } from "../db/auditEventsRepository.js";
import { getRecord } from "./store.js";

const CURATED_AUDIT_TIMELINE: Partial<
  Record<AuditEventType, { kind: TimelineEvent["kind"]; label: string }>
> = {
  BOOKING_ATTEMPTED: {
    kind: "BOOKING_ATTEMPTED",
    label: "Booking attempted",
  },
  DATABASE_UNAVAILABLE: {
    kind: "DATABASE_UNAVAILABLE",
    label: "DATABASE_UNAVAILABLE",
  },
  BOOKING_FAILED: {
    kind: "BOOKING_FAILED",
    label: "Booking failed",
  },
  DATABASE_RECOVERED: {
    kind: "DATABASE_RECOVERED",
    label: "Database recovered",
  },
  BOOKING_CREATED: {
    kind: "BOOKING_SUCCEEDED",
    label: "Booking succeeded",
  },
};

const envelopeSourceRank = (source: TimelineEvent["source"]): number =>
  source === "envelope" ? 0 : 1;

const sortTimelineEvents = (events: TimelineEvent[]): TimelineEvent[] =>
  [...events].sort((a, b) => {
    const byTime = a.timestamp.localeCompare(b.timestamp);
    if (byTime !== 0) {
      return byTime;
    }
    const bySource =
      envelopeSourceRank(a.source) - envelopeSourceRank(b.source);
    if (bySource !== 0) {
      return bySource;
    }
    return a.id.localeCompare(b.id);
  });

const buildEnvelopeTimelineEvents = (
  experimentId: string,
  statusHistory: ExperimentStatusHistoryEntry[],
): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  const seen = new Set<string>();

  for (const entry of statusHistory) {
    if (seen.has(entry.status)) {
      continue;
    }
    seen.add(entry.status);

    const base = {
      source: "envelope" as const,
      timestamp: entry.at,
      requestId: null,
      bookingId: null,
      eventType: null,
    };

    switch (entry.status) {
      case "CREATED":
      case "GENERATING_FAILURE":
      case "VERIFYING_RECOVERY":
        break;
      case "STOPPING_DATABASE":
        events.push({
          ...base,
          id: `${experimentId}-started`,
          kind: "EXPERIMENT_STARTED",
          label: "Experiment started",
        });
        events.push({
          ...base,
          id: `${experimentId}-stopping`,
          kind: "DATABASE_STOPPING",
          label: "Database stopping",
        });
        break;
      case "DATABASE_DOWN":
        events.push({
          ...base,
          id: `${experimentId}-DATABASE_DOWN`,
          kind: "DATABASE_STOPPED",
          label: "Database stopped",
        });
        break;
      case "RECOVERING_DATABASE":
        events.push({
          ...base,
          id: `${experimentId}-RECOVERING_DATABASE`,
          kind: "DATABASE_RESTART_INITIATED",
          label: "Database restart initiated",
        });
        break;
      case "DATABASE_RECOVERED":
        events.push({
          ...base,
          id: `${experimentId}-DATABASE_RECOVERED`,
          kind: "DATABASE_RECOVERED",
          label: "Database recovered",
        });
        break;
      case "COMPLETED":
        events.push({
          ...base,
          id: `${experimentId}-COMPLETED`,
          kind: "EXPERIMENT_COMPLETED",
          label: "Experiment completed",
        });
        break;
      case "FAILED":
        events.push({
          ...base,
          id: `${experimentId}-FAILED`,
          kind: "EXPERIMENT_FAILED",
          label: "Experiment failed",
        });
        break;
    }
  }

  return events;
};

const buildAuditTimelineEvents = (auditEvents: AuditEvent[]): TimelineEvent[] => {
  const events: TimelineEvent[] = [];

  for (const audit of auditEvents) {
    const mapping = CURATED_AUDIT_TIMELINE[audit.eventType];
    if (!mapping) {
      continue;
    }

    events.push({
      id: audit.eventId,
      source: "audit",
      kind: mapping.kind,
      label: mapping.label,
      timestamp: audit.timestamp,
      requestId: audit.requestId,
      bookingId: audit.bookingId,
      eventType: audit.eventType,
    });
  }

  return events;
};

/** Pure merge for tests; returns null when there is no envelope or audit data. */
export const buildTimelineFromSources = (
  experimentId: string,
  statusHistory: ExperimentStatusHistoryEntry[] | undefined,
  auditEvents: AuditEvent[],
): ExperimentTimelineResponse | null => {
  const hasEnvelope = (statusHistory?.length ?? 0) > 0;
  if (!hasEnvelope && auditEvents.length === 0) {
    return null;
  }

  let envelopeEvents = statusHistory
    ? buildEnvelopeTimelineEvents(experimentId, statusHistory)
    : [];

  const auditEventsForTimeline = buildAuditTimelineEvents(auditEvents);

  const hasAuditDatabaseRecovered = auditEvents.some(
    (event) => event.eventType === "DATABASE_RECOVERED",
  );
  if (hasAuditDatabaseRecovered) {
    envelopeEvents = envelopeEvents.filter(
      (event) => event.kind !== "DATABASE_RECOVERED",
    );
  }

  const events = sortTimelineEvents([
    ...envelopeEvents,
    ...auditEventsForTimeline,
  ]);

  return { experimentId, events };
};

export const composeTimeline = async (
  experimentId: string,
): Promise<ExperimentTimelineResponse | null> => {
  const record = getRecord(experimentId);
  const auditEvents = await listAuditEvents({ experimentId });
  return buildTimelineFromSources(
    experimentId,
    record?.statusHistory,
    auditEvents,
  );
};
