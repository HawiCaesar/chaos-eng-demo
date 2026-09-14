import { z } from "zod";

export const experimentScenarioSchema = z.enum(["database-outage"]);

export type ExperimentScenario = z.infer<typeof experimentScenarioSchema>;

export const experimentStatusSchema = z.enum([
  "CREATED",
  "STOPPING_DATABASE",
  "DATABASE_DOWN",
  "GENERATING_FAILURE",
  "RECOVERING_DATABASE",
  "DATABASE_RECOVERED",
  "VERIFYING_RECOVERY",
  "COMPLETED",
  "FAILED",
]);

export type ExperimentStatus = z.infer<typeof experimentStatusSchema>;

export const createExperimentBodySchema = z.object({
  scenario: experimentScenarioSchema.optional(),
});

export type CreateExperimentBody = z.infer<typeof createExperimentBodySchema>;

export const experimentSchema = z.object({
  id: z.string(),
  scenario: experimentScenarioSchema,
  status: experimentStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  error: z.string().nullable(),
  failureRequestId: z.string().uuid().nullable(),
  recoveryBookingId: z.string().nullable(),
});

export type Experiment = z.infer<typeof experimentSchema>;

export const experimentStatusHistoryEntrySchema = z.object({
  status: experimentStatusSchema,
  at: z.string().datetime(),
});

export type ExperimentStatusHistoryEntry = z.infer<
  typeof experimentStatusHistoryEntrySchema
>;
