import type { CreateBookingInput, Experiment, ExperimentStatus } from "@hotel-chaos/shared";
import { RailwayClientError } from "@hotel-chaos/railway-client";
import { randomUUID } from "node:crypto";
import { executeCreateBooking } from "../bookings/executeCreateBooking.js";
import { probeDatabase } from "../db/probe.js";
import { getPool } from "../db/pool.js";
import {
  restartPrimaryDatabase,
} from "../infrastructure/primaryDbLifecycle.js";
import { isDatabaseUnavailable } from "../errors.js";
import { recordAuditEvent } from "../audit/recordAuditEvent.js";
import { DOWN_TIMEOUT_MS, UP_TIMEOUT_MS } from "./orchestratorConstants.js";
import { pollUntil } from "./pollProbe.js";
import { get, getInFlight, getRecord, update } from "./store.js";
import { waitForPrimaryDatabaseDown } from "./waitForPrimaryDatabaseDown.js";

export { DOWN_TIMEOUT_MS, UP_TIMEOUT_MS } from "./orchestratorConstants.js";
export { pollUntil, POLL_INTERVAL_MS } from "./pollProbe.js";

const POST_STOP_STATUSES = new Set<ExperimentStatus>([
  "DATABASE_DOWN",
  "GENERATING_FAILURE",
  "RECOVERING_DATABASE",
  "DATABASE_RECOVERED",
  "VERIFYING_RECOVERY",
]);

const toErrorMessage = (error: unknown): string => {
  if (error instanceof RailwayClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Experiment failed";
};

const buildSyntheticBookingPayload = (): CreateBookingInput => {
  const now = new Date();
  const checkIn = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const checkOut = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2),
  );

  return {
    guestName: "Chaos Experiment",
    email: "experiment@hotel-chaos.local",
    roomId: "101",
    checkIn: checkIn.toISOString().slice(0, 10),
    checkOut: checkOut.toISOString().slice(0, 10),
  };
};

export const fail = async (id: string, error: unknown): Promise<void> => {
  const record = getRecord(id);
  const statusBeforeFail = record?.status;
  let message = toErrorMessage(error);

  update(id, { status: "FAILED", error: message });

  const probe = await probeDatabase(getPool());
  const shouldRestart =
    (statusBeforeFail !== undefined && POST_STOP_STATUSES.has(statusBeforeFail)) ||
    probe === "down";

  if (!shouldRestart) {
    return;
  }

  try {
    await restartPrimaryDatabase();
  } catch (restartError) {
    message = `${message}; restart failed: ${toErrorMessage(restartError)}`;
    update(id, { error: message });
  }
};

export const runExperiment = async (id: string): Promise<void> => {
  update(id, { status: "STOPPING_DATABASE" });

  await waitForPrimaryDatabaseDown(id, DOWN_TIMEOUT_MS);
  update(id, { status: "DATABASE_DOWN" });

  update(id, { status: "GENERATING_FAILURE" });
  const failureRequestId = randomUUID();
  await recordAuditEvent({
    eventType: "REQUEST_RECEIVED",
    requestId: failureRequestId,
    experimentId: id,
  });

  try {
    await executeCreateBooking(buildSyntheticBookingPayload(), failureRequestId);
    throw new Error("expected DATABASE_UNAVAILABLE");
  } catch (error) {
    if (!isDatabaseUnavailable(error)) {
      throw error;
    }
  }

  update(id, { failureRequestId });

  update(id, { status: "RECOVERING_DATABASE" });
  await restartPrimaryDatabase();

  await pollUntil((result) => result === "up", UP_TIMEOUT_MS);

  const recoveryRequestId = randomUUID();
  await recordAuditEvent({
    eventType: "DATABASE_RECOVERED",
    requestId: recoveryRequestId,
    experimentId: id,
    bookingId: null,
  });
  update(id, { status: "DATABASE_RECOVERED" });

  update(id, { status: "VERIFYING_RECOVERY" });
  const verificationRequestId = randomUUID();
  await recordAuditEvent({
    eventType: "REQUEST_RECEIVED",
    requestId: verificationRequestId,
    experimentId: id,
  });

  const booking = await executeCreateBooking(
    buildSyntheticBookingPayload(),
    verificationRequestId,
  );

  update(id, { recoveryBookingId: booking.bookingId, status: "COMPLETED" });
};

let startSerialized = false;

export const startExperiment = (id: string): Experiment => {
  const experiment = get(id);
  if (!experiment) {
    throw new Error("Experiment not found");
  }

  if (experiment.status !== "CREATED") {
    throw new Error("Experiment is not startable");
  }

  const inFlight = getInFlight();
  if (inFlight && inFlight.id !== id) {
    throw new Error("Another experiment is in progress");
  }

  if (startSerialized) {
    throw new Error("Experiment start already in progress");
  }

  startSerialized = true;
  update(id, { status: "STOPPING_DATABASE" });

  void runExperiment(id)
    .catch((error: unknown) => fail(id, error))
    .finally(() => {
      startSerialized = false;
    });

  const started = get(id);
  if (!started) {
    throw new Error("Experiment not found");
  }

  return started;
};
