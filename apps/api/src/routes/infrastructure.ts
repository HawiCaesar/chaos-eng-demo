import type {
  InfrastructureServiceKey,
  InfrastructureServiceStatus,
  InfrastructureStatusResponse,
  ServiceLifecycleStatus,
} from "@hotel-chaos/shared";
import { Router } from "express";
import { getAuditPool } from "../db/auditPool.js";
import { getPool } from "../db/pool.js";
import { probeDatabase, type DatabaseProbeResult } from "../db/probe.js";
import { env } from "../env.js";
import { railwayClient } from "../railway.js";

const STARTING_DEPLOYMENT_STATUSES = new Set([
  "INITIALIZING",
  "BUILDING",
  "DEPLOYING",
  "QUEUED",
  "WAITING",
]);

const FAILED_DEPLOYMENT_STATUSES = new Set(["CRASHED", "FAILED"]);

/**
 * Railway `latestDeployment.status` stays SUCCESS after deploymentStop (container
 * is down, deploy record is not rewritten). For DBs, availability is a SQL probe;
 * Railway raw status only distinguishes STARTING vs FAILED vs STOPPED when down.
 */
const toDatabaseLifecycleStatus = (
  probe: DatabaseProbeResult,
  rawDeploymentStatus: string,
): ServiceLifecycleStatus => {
  if (probe === "up") {
    return "RUNNING";
  }

  const raw = rawDeploymentStatus.trim().toUpperCase();

  if (STARTING_DEPLOYMENT_STATUSES.has(raw)) {
    return "STARTING";
  }

  if (FAILED_DEPLOYMENT_STATUSES.has(raw)) {
    return "FAILED";
  }

  return "STOPPED";
};

type ServiceAction = "stop" | "restart";

type ServiceDefinition = {
  key: InfrastructureServiceKey;
  label: string;
  serviceId: string;
  actions: ServiceAction[];
};

const serviceDefinitions: ServiceDefinition[] = [
  {
    key: "primary-db",
    label: "Primary DB",
    serviceId: env.RAILWAY_PRIMARY_DB_SERVICE_ID,
    actions: ["stop", "restart"],
  },
  {
    key: "audit-db",
    label: "Audit DB",
    serviceId: env.RAILWAY_AUDIT_DB_SERVICE_ID,
    actions: [],
  },
  {
    key: "booking-api",
    label: "Booking API",
    serviceId: env.RAILWAY_API_SERVICE_ID,
    actions: [],
  },
];

export const infrastructureRouter = Router();

infrastructureRouter.get("/infrastructure", async (_req, res, next) => {
  try {
    const [railwayResults, primaryProbe, auditProbe] = await Promise.all([
      Promise.all(
        serviceDefinitions.map((definition) =>
          railwayClient.getServiceStatus(definition.serviceId),
        ),
      ),
      probeDatabase(getPool()),
      probeDatabase(getAuditPool()),
    ]);

    const probes: Record<"primary-db" | "audit-db", DatabaseProbeResult> = {
      "primary-db": primaryProbe,
      "audit-db": auditProbe,
    };

    const services: InfrastructureServiceStatus[] = serviceDefinitions.map(
      (definition, index) => {
        const result = railwayResults[index];
        const status: ServiceLifecycleStatus =
          definition.key === "booking-api"
            ? result.status
            : toDatabaseLifecycleStatus(probes[definition.key], result.rawDeploymentStatus);

        return {
          key: definition.key,
          label: definition.label,
          serviceId: definition.serviceId,
          status,
          rawDeploymentStatus: result.rawDeploymentStatus,
          deploymentId: result.deploymentId,
          actions: definition.actions,
        };
      },
    );

    const response: InfrastructureStatusResponse = {
      environmentId: env.RAILWAY_ENVIRONMENT_ID,
      services,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

infrastructureRouter.post("/infrastructure/primary-db/stop", async (_req, res, next) => {
  try {
    await railwayClient.stopService(env.RAILWAY_PRIMARY_DB_SERVICE_ID);
    res.status(202).json({ key: "primary-db", action: "stop" });
  } catch (error) {
    next(error);
  }
});

infrastructureRouter.post("/infrastructure/primary-db/restart", async (_req, res, next) => {
  try {
    await railwayClient.restartService(env.RAILWAY_PRIMARY_DB_SERVICE_ID);
    res.status(202).json({ key: "primary-db", action: "restart" });
  } catch (error) {
    next(error);
  }
});
