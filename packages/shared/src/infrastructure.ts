import { z } from "zod";

export const serviceLifecycleStatusSchema = z.enum([
  "RUNNING",
  "STOPPING",
  "STOPPED",
  "STARTING",
  "FAILED",
]);

export type ServiceLifecycleStatus = z.infer<typeof serviceLifecycleStatusSchema>;

export const infrastructureServiceKeySchema = z.enum([
  "primary-db",
  "audit-db",
  "booking-api",
]);

export type InfrastructureServiceKey = z.infer<typeof infrastructureServiceKeySchema>;

export const infrastructureServiceStatusSchema = z.object({
  key: infrastructureServiceKeySchema,
  label: z.string(),
  serviceId: z.string(),
  status: serviceLifecycleStatusSchema,
  rawDeploymentStatus: z.string(),
  deploymentId: z.string().optional(),
  actions: z.array(z.enum(["stop", "restart"])),
});

export type InfrastructureServiceStatus = z.infer<typeof infrastructureServiceStatusSchema>;

export const infrastructureStatusResponseSchema = z.object({
  environmentId: z.string(),
  services: z.array(infrastructureServiceStatusSchema),
});

export type InfrastructureStatusResponse = z.infer<typeof infrastructureStatusResponseSchema>;
