import { probeDatabase } from "../db/probe.js";
import { getPool } from "../db/pool.js";
import { stopPrimaryDatabase } from "../infrastructure/primaryDbLifecycle.js";
import { pollUntil } from "./pollProbe.js";

const CONFIRM_DOWN_DELAY_MS = 500;

const logProbe = (experimentId: string, label: string, probe: string): void => {
  console.log(`[experiment ${experimentId}] primary probe ${label}: ${probe}`);
};

/**
 * M6: If probe is stably down, skip Railway stop. If up, stop then wait for probe down.
 */
export const waitForPrimaryDatabaseDown = async (
  experimentId: string,
  timeoutMs: number,
): Promise<void> => {
  let probe = await probeDatabase(getPool());
  logProbe(experimentId, "initial", probe);

  if (probe === "down") {
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_DOWN_DELAY_MS));
    probe = await probeDatabase(getPool());
    logProbe(experimentId, "confirm (already down)", probe);
    if (probe === "down") {
      return;
    }
  }

  try {
    await stopPrimaryDatabase();
    console.log(`[experiment ${experimentId}] Railway stopService completed`);
  } catch (stopError) {
    probe = await probeDatabase(getPool());
    logProbe(experimentId, "after stop error", probe);
    if (probe === "up") {
      throw stopError;
    }
    return;
  }

  probe = await probeDatabase(getPool());
  logProbe(experimentId, "after stop", probe);
  if (probe === "down") {
    return;
  }

  await pollUntil((result) => result === "down", timeoutMs);
};
