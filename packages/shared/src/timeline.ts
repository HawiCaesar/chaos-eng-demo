import { z } from "zod";

export const timelineEventSourceSchema = z.enum(["envelope", "audit"]);

export type TimelineEventSource = z.infer<typeof timelineEventSourceSchema>;

export const timelineEventKindSchema = z.enum([
  "EXPERIMENT_STARTED",
  "DATABASE_STOPPING",
  "DATABASE_STOPPED",
  "BOOKING_ATTEMPTED",
  "DATABASE_UNAVAILABLE",
  "BOOKING_FAILED",
  "DATABASE_RESTART_INITIATED",
  "DATABASE_RECOVERED",
  "BOOKING_SUCCEEDED",
  "EXPERIMENT_COMPLETED",
  "EXPERIMENT_FAILED",
]);

export type TimelineEventKind = z.infer<typeof timelineEventKindSchema>;

export const timelineEventSchema = z.object({
  id: z.string(),
  source: timelineEventSourceSchema,
  kind: timelineEventKindSchema,
  label: z.string(),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid().nullable(),
  bookingId: z.string().nullable(),
  eventType: z.string().nullable(),
});

export type TimelineEvent = z.infer<typeof timelineEventSchema>;

export const experimentTimelineResponseSchema = z.object({
  experimentId: z.string(),
  events: z.array(timelineEventSchema),
});

export type ExperimentTimelineResponse = z.infer<
  typeof experimentTimelineResponseSchema
>;
