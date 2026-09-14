import type {
  Experiment,
  ExperimentScenario,
  ExperimentStatus,
  ExperimentStatusHistoryEntry,
} from "@hotel-chaos/shared";
import { generateExperimentId } from "./ids.js";

export type ExperimentRecord = Experiment & {
  statusHistory: ExperimentStatusHistoryEntry[];
};

export type ExperimentUpdatePatch = Partial<
  Pick<
    Experiment,
    "status" | "error" | "failureRequestId" | "recoveryBookingId"
  >
>;

const TERMINAL_OR_CREATED: ExperimentStatus[] = [
  "CREATED",
  "COMPLETED",
  "FAILED",
];

const experiments = new Map<string, ExperimentRecord>();

const toPublicExperiment = (record: ExperimentRecord): Experiment => {
  const { statusHistory: _statusHistory, ...experiment } = record;
  return experiment;
};

const isInFlightStatus = (status: ExperimentStatus): boolean =>
  !TERMINAL_OR_CREATED.includes(status);

export const create = (scenario: ExperimentScenario): Experiment => {
  let id = generateExperimentId();
  while (experiments.has(id)) {
    id = generateExperimentId();
  }

  const now = new Date().toISOString();
  const record: ExperimentRecord = {
    id,
    scenario,
    status: "CREATED",
    createdAt: now,
    updatedAt: now,
    error: null,
    failureRequestId: null,
    recoveryBookingId: null,
    statusHistory: [{ status: "CREATED", at: now }],
  };

  experiments.set(id, record);
  return toPublicExperiment(record);
};

export const get = (id: string): Experiment | undefined => {
  const record = experiments.get(id);
  if (!record) {
    return undefined;
  }
  return toPublicExperiment(record);
};

/** Includes ephemeral `statusHistory` for timeline composition (M7). */
export const getRecord = (id: string): ExperimentRecord | undefined =>
  experiments.get(id);

export const update = (
  id: string,
  patch: ExperimentUpdatePatch,
): Experiment => {
  const record = experiments.get(id);
  if (!record) {
    throw new Error(`Experiment not found: ${id}`);
  }

  const updatedAt = new Date().toISOString();
  const nextStatus = patch.status ?? record.status;

  if (patch.status !== undefined && patch.status !== record.status) {
    record.statusHistory.push({ status: patch.status, at: updatedAt });
  }

  record.status = nextStatus;
  record.updatedAt = updatedAt;

  if (patch.error !== undefined) {
    record.error = patch.error;
  }
  if (patch.failureRequestId !== undefined) {
    record.failureRequestId = patch.failureRequestId;
  }
  if (patch.recoveryBookingId !== undefined) {
    record.recoveryBookingId = patch.recoveryBookingId;
  }

  return toPublicExperiment(record);
};

export const getInFlight = (): Experiment | undefined => {
  for (const record of experiments.values()) {
    if (isInFlightStatus(record.status)) {
      return toPublicExperiment(record);
    }
  }
  return undefined;
};

export const getActiveExperimentId = (): string | null =>
  getInFlight()?.id ?? null;

export const hasCreatedOrInFlight = (): boolean => {
  for (const record of experiments.values()) {
    if (record.status === "CREATED" || isInFlightStatus(record.status)) {
      return true;
    }
  }
  return false;
};
