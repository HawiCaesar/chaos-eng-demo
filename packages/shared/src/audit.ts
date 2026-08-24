import { z } from "zod";

export const auditEventTypeSchema = z.enum([
  "REQUEST_RECEIVED",
  "VALIDATION_PASSED",
  "BOOKING_ATTEMPTED",
  "DATABASE_UNAVAILABLE",
  "BOOKING_FAILED",
  "DATABASE_RECOVERED",
  "BOOKING_CREATED",
]);

export type AuditEventType = z.infer<typeof auditEventTypeSchema>;

export const auditEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: auditEventTypeSchema,
  requestId: z.string().uuid(),
  bookingId: z.string().nullable(),
  experimentId: z.string().nullable(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export const listAuditEventsQuerySchema = z.object({
  requestId: z.string().uuid().optional(),
  bookingId: z.string().min(1).optional(),
});

export type ListAuditEventsQuery = z.infer<typeof listAuditEventsQuerySchema>;

export const listAuditEventsResponseSchema = z.object({
  events: z.array(auditEventSchema),
});

export type ListAuditEventsResponse = z.infer<typeof listAuditEventsResponseSchema>;
