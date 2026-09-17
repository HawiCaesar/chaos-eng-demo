import { z } from "zod";

import { experimentScenarioSchema } from "./experiment.js";

export const experimentMetricsResultSchema = z.enum([
  "RECOVERED",
  "FAILED",
  "IN_PROGRESS",
  "UNKNOWN",
]);

export type ExperimentMetricsResult = z.infer<
  typeof experimentMetricsResultSchema
>;

export const experimentMetricsResponseSchema = z.object({
  experimentId: z.string(),
  scenario: experimentScenarioSchema,
  totalRequests: z.number().int().nonnegative(),
  successfulRequests: z.number().int().nonnegative(),
  failedRequests: z.number().int().nonnegative(),
  failureRatePercent: z.number().int().min(0).max(100).nullable(),
  databaseDowntimeSeconds: z.number().int().nonnegative().nullable(),
  recoveryTimeSeconds: z.number().int().nonnegative().nullable(),
  result: experimentMetricsResultSchema,
});

export type ExperimentMetricsResponse = z.infer<
  typeof experimentMetricsResponseSchema
>;
