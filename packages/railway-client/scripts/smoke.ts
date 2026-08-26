import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRailwayClientFromEnv } from "../src/index.js";
import type { ServiceStatusResult } from "../src/types.js";

const repoRoot = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
config({ path: resolve(repoRoot, "apps/api/.env") });

const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 5_000;

const EXECUTE_STOP_RESTART = process.argv.includes("--execute-stop-restart");

const sleep = (ms: number): Promise<void> =>
  new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });

const printServiceStatus = (label: string, status: ServiceStatusResult): void => {
  console.log(
    `[${label}] lifecycle=${status.status} raw=${status.rawDeploymentStatus} deploymentId=${status.deploymentId ?? "none"}`,
  );
};

const isStopped = (status: ServiceStatusResult): boolean =>
  status.status === "STOPPED" ||
  status.rawDeploymentStatus === "REMOVED" ||
  status.rawDeploymentStatus === "SLEEPING" ||
  status.rawDeploymentStatus === "NONE";

const isRunning = (status: ServiceStatusResult): boolean =>
  status.status === "RUNNING" && status.rawDeploymentStatus === "SUCCESS";

const pollUntil = async (
  label: string,
  readStatus: () => Promise<ServiceStatusResult>,
  predicate: (status: ServiceStatusResult) => boolean,
): Promise<ServiceStatusResult> => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await readStatus();
    printServiceStatus(label, status);
    if (predicate(status)) {
      return status;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`${label}: timed out after ${POLL_TIMEOUT_MS / 1000}s`);
};

const runStatusOnly = async (): Promise<void> => {
  const client = createRailwayClientFromEnv();
  const serviceStatus = await client.getServiceStatus();
  const deploymentStatus = await client.getDeploymentStatus();

  console.log(JSON.stringify({ serviceStatus, deploymentStatus }, null, 2));
};

const runStopRestartCycle = async (): Promise<void> => {
  console.warn(
    "WARNING: --execute-stop-restart stops primary Postgres. POST /bookings may return 503 until RUNNING again.",
  );

  const client = createRailwayClientFromEnv();

  printServiceStatus("before", await client.getServiceStatus());

  console.log("Stopping primary Postgres service deployment…");
  await client.stopService();

  await pollUntil("stop-poll", () => client.getServiceStatus(), isStopped);

  console.log("Restarting primary Postgres service deployment…");
  await client.restartService();

  await pollUntil("restart-poll", () => client.getServiceStatus(), isRunning);

  const deploymentStatus = await client.getDeploymentStatus();
  console.log(JSON.stringify({ deploymentStatus }, null, 2));
};

const main = async (): Promise<void> => {
  if (EXECUTE_STOP_RESTART) {
    await runStopRestartCycle();
    return;
  }
  await runStatusOnly();
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
