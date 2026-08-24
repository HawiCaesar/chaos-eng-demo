import type { AuditEvent, AuditEventType } from "@hotel-chaos/shared";
import { getAuditPool } from "./auditPool.js";

type AuditEventRow = {
  id: string;
  event_type: string;
  request_id: string;
  booking_id: string | null;
  experiment_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
};

const mapRowToAuditEvent = (row: AuditEventRow): AuditEvent => ({
  eventId: row.id,
  eventType: row.event_type as AuditEventType,
  requestId: row.request_id,
  bookingId: row.booking_id,
  experimentId: row.experiment_id,
  timestamp: row.created_at.toISOString(),
  metadata: row.metadata ?? {},
});

export type InsertAuditEventInput = {
  eventType: AuditEventType;
  requestId: string;
  bookingId?: string | null;
  experimentId?: string | null;
  metadata?: Record<string, unknown>;
};

export const insertAuditEvent = async (
  input: InsertAuditEventInput,
): Promise<AuditEvent> => {
  const { rows } = await getAuditPool().query<AuditEventRow>(
    `
      INSERT INTO audit_events (
        event_type,
        request_id,
        booking_id,
        experiment_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING
        id,
        event_type,
        request_id,
        booking_id,
        experiment_id,
        metadata,
        created_at
    `,
    [
      input.eventType,
      input.requestId,
      input.bookingId ?? null,
      input.experimentId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to insert audit event");
  }

  return mapRowToAuditEvent(row);
};

export const listAuditEvents = async (filters: {
  requestId?: string;
  bookingId?: string;
}): Promise<AuditEvent[]> => {
  const conditions: string[] = [];
  const values: string[] = [];

  if (filters.requestId) {
    values.push(filters.requestId);
    conditions.push(`request_id = $${values.length}`);
  }

  if (filters.bookingId) {
    values.push(filters.bookingId);
    conditions.push(`booking_id = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await getAuditPool().query<AuditEventRow>(
    `
      SELECT
        id,
        event_type,
        request_id,
        booking_id,
        experiment_id,
        metadata,
        created_at
      FROM audit_events
      ${whereClause}
      ORDER BY created_at ASC
    `,
    values,
  );

  return rows.map(mapRowToAuditEvent);
};
