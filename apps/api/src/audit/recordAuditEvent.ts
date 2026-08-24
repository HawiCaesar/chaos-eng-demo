import type { AuditEventType } from "@hotel-chaos/shared";
import { insertAuditEvent } from "../db/auditEventsRepository.js";

export type RecordAuditEventParams = {
  eventType: AuditEventType;
  requestId: string;
  bookingId?: string | null;
  experimentId?: string | null;
  metadata?: Record<string, unknown>;
};

export type RecordAuditEventOptions = {
  critical?: boolean;
};

export const recordAuditEvent = async (
  params: RecordAuditEventParams,
  options: RecordAuditEventOptions = {},
): Promise<void> => {
  try {
    await insertAuditEvent(params);
  } catch (error) {
    const prefix = options.critical ? "critical audit write failed" : "audit write failed";
    console.error(prefix, { eventType: params.eventType, requestId: params.requestId }, error);
  }
};
